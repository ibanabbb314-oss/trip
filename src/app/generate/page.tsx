'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setResult(data.text);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Generator</h1>
        <p className="text-muted-foreground">
          AI를 사용하여 텍스트를 생성합니다. 프롬프트를 입력하고 생성 버튼을 클릭하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>프롬프트 입력</CardTitle>
          <CardDescription>
            생성하고 싶은 내용에 대해 자세히 설명해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">프롬프트</Label>
              <Textarea
                id="prompt"
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="예: 제주도 2박 3일 여행 계획을 세워주세요. 예산은 50만원이고, 사진 명소와 맛집을 중심으로 추천해주세요."
                className="resize-none"
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !prompt.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">오류 발생</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>생성 결과</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {result}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

