import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';
import { format, addDays, parseISO } from 'date-fns';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, startDate, endDate, people, budget } = body || {};

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: '여행지, 출발일, 귀국일은 필수 입력값입니다.' },
        { status: 400 }
      );
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 날짜 배열 생성
    const dateArray: string[] = [];
    let currentDate = start;
    while (currentDate <= end) {
      dateArray.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }

    const prompt = `
당신은 전문 여행 플래너입니다. 아래 정보를 바탕으로 JSON 형식으로만 응답해주세요.

**중요: 반드시 유효한 JSON만 출력하세요. 마크다운 코드블럭, 설명, 주석 없이 순수 JSON만 출력하세요.**

JSON 스키마:
{
  "summary": {
    "budget": {
      "accommodation": 0,
      "food": 0,
      "transportation": 0,
      "attractions": 0,
      "other": 0,
      "total": 0
    },
    "tips": [],
    "overview": "",
    "notes": ""
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "title": "",
      "summary": "",
      "items": [
        {
          "time": "HH:MM",
          "place": "",
          "activity": "",
          "notes": ""
        }
      ]
    }
  ]
}

입력 정보:
- destination: ${destination}
- startDate: ${startDate}
- endDate: ${endDate}
- people: ${people ?? 1}
- budget: ${budget ?? 0}
- dates: ${JSON.stringify(dateArray)}

요구사항:
1. startDate~endDate 사이 모든 날짜를 days 배열에 포함 (총 ${totalDays}일)
2. 각 day.items는 5~8개 정도로, 이동/식사/관광/휴식 등을 포함
3. 모든 날짜는 YYYY-MM-DD 형식, 시간은 HH:MM 형식
4. summary.budget는 총 예산(${budget ?? 0}원)을 적절히 분배
5. summary.tips는 5개 정도의 여행 팁 배열
6. summary.overview는 여행지 소개 및 전반적인 정보
7. summary.notes는 주의사항 등

**응답은 반드시 유효한 JSON 형식만 출력하세요. 다른 텍스트나 설명은 포함하지 마세요.**
`.trim();

    // JSON 응답 요청 (프롬프트 기반)
    const raw = await generateText({ prompt, json: false });

    // JSON 파싱
    let parsed: any;
    try {
      // 마크다운 코드블럭 제거
      let cleaned = raw.trim();
      
      // ```json ... ``` 형식 제거
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      
      // JSON 객체 시작 부분 찾기
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON 파싱 실패:', e);
      console.error('Raw response (first 1000 chars):', raw.substring(0, 1000));
      return NextResponse.json(
        { error: 'AI 응답 JSON 파싱 실패', raw: raw.substring(0, 500) },
        { status: 500 }
      );
    }

    // 간단 검증
    if (!parsed?.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 days 구조', parsed },
        { status: 500 }
      );
    }

    for (const d of parsed.days) {
      if (!d?.date || !d?.items || !Array.isArray(d.items)) {
        return NextResponse.json(
          { error: 'day에 date/items 누락', day: d },
          { status: 500 }
        );
      }
    }

    // planId 생성 (간단한 타임스탬프 기반)
    const planId = `plan-${Date.now()}`;

    // 프론트가 날짜별 페이지를 바로 렌더할 수 있도록 days와 summary 반환
    return NextResponse.json(
      {
        planId,
        destination,
        startDate,
        endDate,
        summary: parsed.summary || {},
        days: parsed.days,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
