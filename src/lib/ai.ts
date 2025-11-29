// src/lib/ai.ts
import 'server-only';

type GenOpts = { 
  prompt: string; 
  json?: boolean;
  searchContext?: string; // 검색 결과 컨텍스트
  enableSearch?: boolean; // 검색 기능 활성화
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // 503, 429, 500-599 범위의 서버 오류는 재시도
      if (res.status === 503 || res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < maxRetries - 1) {
          // 지수 백오프: 1초, 2초, 4초...
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(
            `API 오류 ${res.status}, ${delay}ms 후 재시도... (${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }
      }

      return res;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`네트워크 오류, ${delay}ms 후 재시도... (${attempt + 1}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('재시도 횟수 초과');
}

export async function generateText({ prompt, json = false, searchContext, enableSearch }: GenOpts): Promise<string> {
  const provider = (process.env.AI_PROVIDER || 'google').toLowerCase().trim();
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error('Missing AI_API_KEY in environment variables');

  // 검색 컨텍스트가 있으면 프롬프트에 추가
  let finalPrompt = prompt;
  if (searchContext) {
    finalPrompt = `${searchContext}\n\n---\n\n${prompt}`;
  }

  // --- Google AI Studio (Gemini) ---
  if (provider === 'google' || provider === 'gemini') {
    const model = process.env.GOOGLE_MODEL || 'gemini-2.5-flash';
    
    // Gemini 2.0 Flash 모델은 Google Search 통합을 지원하므로 tools 활성화
    const useSearchTool = enableSearch && model.includes('2.0');
    
    const url =
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(key)}`;

    const body: any = {
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
    };
    
    // Google Search Tool 활성화 (Gemini 2.0 이상)
    if (useSearchTool) {
      body.tools = [
        {
          googleSearchRetrieval: {}
        }
      ];
    }
    
    // Google Gemini는 generationConfig에서 JSON을 강제할 수 없으므로
    // 프롬프트에서 JSON 형식을 명시하는 방식 사용
    // json 옵션은 다른 프로바이더를 위해 유지

    const res = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      3, // 최대 3회 재시도
      1000 // 초기 지연 1초
    );

    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `Google AI error: ${res.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        errorMessage = `Google AI error: ${res.status} ${errorText}`;
      }

      // 503 오류에 대한 친절한 메시지
      if (res.status === 503) {
        throw new Error(
          'Google AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
        );
      }

      throw new Error(errorMessage);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') ?? '';
    return text;
  }


  // --- OpenAI ---
  if (provider === 'openai') {
    const res = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: enableSearch ? 'gpt-4o' : 'gpt-4o-mini', // 검색 활성화 시 더 강력한 모델 사용
          messages: [{ role: 'user', content: finalPrompt }],
          temperature: 0.7,
          ...(enableSearch && {
            tools: [{
              type: 'function',
              function: {
                name: 'search_web',
                description: 'Search the web for current information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Search query' }
                  },
                  required: ['query']
                }
              }
            }],
            tool_choice: 'auto'
          })
        }),
      },
      3,
      1000
    );
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // --- Anthropic ---
  if (provider === 'anthropic') {
    const res = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 4096,
          messages: [{ role: 'user', content: finalPrompt }],
        }),
      },
      3,
      1000
    );
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const text = Array.isArray(data.content)
      ? (data.content.find((b: any) => b.type === 'text')?.text ?? '')
      : '';
    return text;
  }

  // --- Together ---
  if (provider === 'together') {
    const res = await fetchWithRetry(
      'https://api.together.xyz/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3-8b-chat-hf',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      },
      3,
      1000
    );
    if (!res.ok) throw new Error(`Together AI API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // --- Perplexity ---
  // Perplexity는 기본적으로 온라인 검색 기능이 활성화되어 있음
  if (provider === 'perplexity') {
    const model = enableSearch 
      ? 'llama-3.1-sonar-large-128k-online' // 검색 활성화 시 더 강력한 모델
      : 'llama-3.1-sonar-small-128k-online';
    
    const res = await fetchWithRetry(
      'https://api.perplexity.ai/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: finalPrompt }],
          temperature: 0.7,
        }),
      },
      3,
      1000
    );
    if (!res.ok) throw new Error(`Perplexity API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error(
    `Unsupported AI_PROVIDER: ${provider}. Supported: google/gemini, openai, anthropic, together, perplexity`
  );
}
