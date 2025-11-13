'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';

export default function CreatePlanPage() {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        destination: destination.trim(),
        startDate,
        endDate,
        people: travelers,
        budget: budget ? Number(budget) : 0,
      };

      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '요청 실패');
      }

      setResult(data.text);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-3">AI 여행 계획 생성기</h1>
        <p className="text-muted-foreground text-lg">
          여행지와 기간만 입력하면 AI가 맞춤형 여행 계획과 예산을 제안해드립니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>여행 정보 입력</CardTitle>
          <CardDescription>
            필수 정보만 입력하시면 AI가 맞춤형 여행 계획을 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="destination" className="text-base font-medium">
                여행지 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="destination"
                name="destination"
                placeholder="예: 제주도, 부산, 서울, 제주도 3박 4일"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                disabled={loading}
                className="h-12 text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-base font-medium">
                  출발일 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-base font-medium">
                  귀국일 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="travelers" className="text-base font-medium">
                  인원 (선택)
                </Label>
                <Input
                  id="travelers"
                  name="people"
                  type="number"
                  min="1"
                  value={travelers}
                  onChange={(e) => setTravelers(Number(e.target.value))}
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget" className="text-base font-medium">
                  총 예산 (선택)
                </Label>
                <Input
                  id="budget"
                  name="budget"
                  type="number"
                  placeholder="예: 500000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !destination.trim() || !startDate || !endDate}
              className="w-full h-12 text-base"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  AI가 계획을 생성하고 있습니다...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  여행 계획 생성하기
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
            <CardTitle className="text-2xl">생성된 여행 계획</CardTitle>
            <CardDescription>
              AI가 생성한 맞춤형 여행 계획입니다. 아래 내용을 확인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 border rounded-lg p-6 md:p-8">
              <div className="prose prose-lg max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-base md:text-lg leading-8 text-foreground">
                  {result}
                </pre>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => {
                  setResult(null);
                  setDestination('');
                  setStartDate('');
                  setEndDate('');
                  setTravelers(2);
                  setBudget('');
                }}
                variant="outline"
                className="flex-1"
              >
                새 계획 만들기
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  alert('계획이 클립보드에 복사되었습니다!');
                }}
                variant="outline"
                className="flex-1"
              >
                계획 복사하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
