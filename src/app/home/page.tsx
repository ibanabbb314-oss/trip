'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
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

      // JSON 형식의 응답 받음
      const resultData = {
        planId: data.planId,
        destination: data.destination,
        startDate: data.startDate,
        endDate: data.endDate,
        summary: data.summary,
        days: data.days,
      };

      // localStorage에 결과 저장
      if (typeof window !== 'undefined') {
        const resultKey = `plan-result-${Date.now()}`;
        localStorage.setItem(resultKey, JSON.stringify(resultData));
        
        // 저장 확인 후 새 탭 열기
        const verifyAndOpen = () => {
          const saved = localStorage.getItem(resultKey);
          if (saved) {
            const savedData = JSON.parse(saved);
            if (savedData.days && savedData.days.length > 0) {
              const resultUrl = `/plan-result?key=${resultKey}`;
              
              // 새 탭으로 열기 시도
              const newTab = window.open(resultUrl, '_blank');
              
              // 새 탭이 열리지 않으면 (팝업 차단) 같은 페이지에서 결과 페이지로 이동
              if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
                router.push(resultUrl);
              }
            } else {
              throw new Error('날짜별 계획 데이터가 없습니다.');
            }
          } else {
            // 저장이 안 되었으면 재시도
            setTimeout(verifyAndOpen, 50);
          }
        };
        
        // 즉시 확인 시도
        verifyAndOpen();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8 max-w-4xl">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-12 mb-12">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          여행지를 입력하면,
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI가 모든 것을 최적화해드립니다
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          예산부터 일정까지, 대학생을 위한 맞춤형 여행 계획 서비스
        </p>
      </section>

      {/* 여행 계획 생성 폼 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">여행 정보 입력</CardTitle>
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
                placeholder="예: 제주도, 부산, 서울"
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

      {/* 에러 메시지 */}
      {error && (
        <Card className="mt-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">오류 발생</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 성공 메시지 */}
      {result && (
        <Card className="mt-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-center text-green-700 font-medium">{result}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
