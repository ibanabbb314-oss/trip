'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, X, Loader2, Plane, Hotel, ExternalLink, RefreshCw, MapPin, Navigation, Image, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DayItem {
  time: string;
  place: string;
  activity: string;
  notes?: string;
  cost?: number;
  next_move_duration?: string;
  image_search_link?: string;
}

interface DayPlan {
  date: string;
  title: string;
  summary: string;
  daily_estimated_cost?: number;
  items: DayItem[];
}

interface EstimatedBudget {
  total_amount: number;
  currency: string;
  breakdown: {
    flight_cost?: number;
    accommodation_cost?: number;
    local_transport_cost?: number;
    food_and_drink_cost?: number;
    activities_and_tours_cost?: number;
    contingency_and_misc?: number;
    // 하위 호환성을 위한 기존 필드 (선택사항)
    food?: number;
    accommodation?: number;
    transportation?: number;
    activities?: number;
    misc?: number;
  };
}

interface Summary {
  budget?: {
    accommodation?: number;
    food?: number;
    transportation?: number;
    attractions?: number;
    other?: number;
    total?: number;
  };
  tips?: string[];
  overview?: string;
  notes?: string;
  accommodation_selection_reason?: string;
}

interface ExternalLinks {
  flight_search_url: string;
  accommodation_search_url: string;
}

interface PlanData {
  planId: string;
  destination: string;
  startDate: string;
  endDate: string;
  estimated_budget?: EstimatedBudget;
  external_links?: ExternalLinks;
  summary: Summary;
  days: DayPlan[];
}

function PlanResultContent() {
  const searchParams = useSearchParams();
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const hasLoadedRef = useRef(false);
  
  // 예산 재조정 상태
  const [realFlightCost, setRealFlightCost] = useState<string>('');
  const [realAccommodationCost, setRealAccommodationCost] = useState<string>('');
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [rebalanceSuccess, setRebalanceSuccess] = useState(false);

  useEffect(() => {
    // 이미 로드했으면 다시 로드하지 않음
    if (hasLoadedRef.current || typeof window === 'undefined') return;

    const key = searchParams.get('key');
    if (!key) {
      hasLoadedRef.current = true;
      return;
    }

    // localStorage에서 가져오기 (강화된 재시도 로직)
    let retryCount = 0;
    const maxRetries = 20; // 최대 2초 대기 (20 * 100ms)
    
    const loadResult = () => {
      // 이미 로드했으면 중단
      if (hasLoadedRef.current) return;
      
      const savedData = localStorage.getItem(key);
      if (savedData) {
        try {
          const data: PlanData = JSON.parse(savedData);
          setPlanData(data);
          hasLoadedRef.current = true;
          // 사용 후 삭제 (약간의 지연을 두어 안정성 확보)
          setTimeout(() => {
            localStorage.removeItem(key);
          }, 1000);
        } catch (error) {
          console.error('Failed to parse plan data:', error);
          hasLoadedRef.current = true;
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          // 100ms마다 재시도
          setTimeout(loadResult, 100);
        } else {
          hasLoadedRef.current = true;
        }
      }
    };

    // 즉시 시도
    loadResult();
  }, [searchParams]);

  const handleCopy = () => {
    if (planData) {
      const text = JSON.stringify(planData, null, 2);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    window.close();
  };

  // CSV 다운로드 함수
  const handleDownloadCSV = () => {
    if (!planData) return;

    // CSV 헤더
    const headers = ['일자', '날짜', '시간', '장소', '활동', '예상 비용 (원)', '이동 시간', '비고'];
    
    // CSV 데이터 행 생성
    const rows: string[][] = [];
    
    planData.days.forEach((day, dayIndex) => {
      day.items.forEach((item) => {
        const dateLabel = format(parseISO(day.date), 'yyyy-MM-dd', { locale: ko });
        const dayLabel = `${dayIndex + 1}일차`;
        
        rows.push([
          dayLabel,
          dateLabel,
          item.time || '',
          item.place || '',
          item.activity || '',
          item.cost ? item.cost.toString() : '',
          item.next_move_duration || '',
          item.notes || '',
        ]);
      });
      
      // 날짜별 구분선 추가 (선택사항)
      if (dayIndex < planData.days.length - 1) {
        rows.push(['', '', '', '', '', '', '', '']);
      }
    });

    // CSV 내용 생성 (BOM 추가로 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // CSV에서 쉼표, 따옴표, 줄바꿈 처리를 위한 인용부호 추가
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    // Blob 생성 및 다운로드
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${planData.destination}_여행계획_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // 예산 재조정 함수
  const handleRebalanceBudget = async () => {
    if (!planData || !planData.estimated_budget) {
      setRebalanceError('예산 정보가 없습니다.');
      return;
    }

    const flightCost = realFlightCost.trim();
    const accommodationCost = realAccommodationCost.trim();

    if (!flightCost || !accommodationCost) {
      setRebalanceError('항공권 가격과 숙박 비용을 모두 입력해주세요.');
      return;
    }

    const flightCostNum = Number(flightCost);
    const accommodationCostNum = Number(accommodationCost);

    if (isNaN(flightCostNum) || isNaN(accommodationCostNum) || flightCostNum < 0 || accommodationCostNum < 0) {
      setRebalanceError('유효한 숫자를 입력해주세요.');
      return;
    }

    setRebalancing(true);
    setRebalanceError(null);
    setRebalanceSuccess(false);

    try {
      const response = await fetch('/api/rebalance-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalBudget: planData.estimated_budget,
          realFlightCost: flightCostNum,
          realAccommodationCost: accommodationCostNum,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '예산 재조정 실패');
      }

      // 새로운 estimated_budget로 업데이트 (총 예산 포함)
      if (planData.estimated_budget && data.estimated_budget) {
        setPlanData({
          ...planData,
          estimated_budget: data.estimated_budget,
        });
        setRebalanceSuccess(true);
        setTimeout(() => setRebalanceSuccess(false), 3000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '예산 재조정 중 오류가 발생했습니다.';
      setRebalanceError(errorMessage);
    } finally {
      setRebalancing(false);
    }
  };

  if (!planData || !planData.days || planData.days.length === 0) {
    return (
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">결과를 불러오는 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{planData.destination} 여행 계획</CardTitle>
              <CardDescription className="mt-2">
                전체 요약 및 {planData.days.length}일간의 맞춤형 여행 계획입니다.
              </CardDescription>
              {planData.estimated_budget && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">AI 추정 최적 총 예산</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {planData.estimated_budget.total_amount.toLocaleString()}
                    </span>
                    <span className="text-lg text-muted-foreground">{planData.estimated_budget.currency}</span>
                  </div>
                </div>
              )}
              {/* 액션 버튼들 */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? '복사됨!' : '전체 복사'}
                </Button>
                <Button
                  onClick={handleDownloadCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV 다운로드
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 h-auto mb-6 overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="text-xs md:text-sm px-2 md:px-3 py-2 whitespace-nowrap"
              >
                여행 요약
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="text-xs md:text-sm px-2 md:px-3 py-2 whitespace-nowrap"
              >
                여행 세부사항
              </TabsTrigger>
              {planData.days.map((dayPlan, index) => (
                <TabsTrigger
                  key={dayPlan.date}
                  value={`day-${index}`}
                  className="text-xs md:text-sm px-2 md:px-3 py-2"
                >
                  {index + 1}일차
                </TabsTrigger>
              ))}
            </TabsList>
            
            {/* 여행 요약 탭 (개요, 팁, 주의사항) */}
            <TabsContent value="overview" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">여행 요약</CardTitle>
                  <CardDescription>
                    여행지 개요, 팁, 주의사항 등 기본 정보
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {planData.summary.overview && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">여행지 개요</h3>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {planData.summary.overview}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {planData.summary.tips && planData.summary.tips.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">여행 팁</h3>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            {planData.summary.tips.map((tip, i) => (
                              <li key={i} className="leading-relaxed">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    {planData.summary.notes && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">주의사항</h3>
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {planData.summary.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 여행 세부사항 탭 (예산, 가격 비교 등) */}
            <TabsContent value="summary" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">여행 세부사항</CardTitle>
                  <CardDescription>
                    예산 정보 및 실시간 가격 비교 등 상세 정보
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* 1. 실시간 가격 비교 (외부 검색 링크) */}
                    {planData.external_links && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">1. 실시간 가격 비교</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {planData.external_links.flight_search_url && (
                            <Button
                              asChild
                              variant="outline"
                              className="w-full h-auto py-4 px-4 justify-start hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <a
                                href={planData.external_links.flight_search_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3"
                              >
                                <Plane className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 text-left">
                                  <div className="font-semibold">실시간 항공권 검색</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Skyscanner에서 비교
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                              </a>
                            </Button>
                          )}
                          {planData.external_links.accommodation_search_url && (
                            <Button
                              asChild
                              variant="outline"
                              className="w-full h-auto py-4 px-4 justify-start hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <a
                                href={planData.external_links.accommodation_search_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3"
                              >
                                <Hotel className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 text-left">
                                  <div className="font-semibold">실시간 숙소 검색</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Booking.com에서 비교
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. 숙소 추천 지역 */}
                    {planData.summary.accommodation_selection_reason && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            2. AI 추천 숙소 위치
                          </h3>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {planData.summary.accommodation_selection_reason}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3. 실시간 가격 반영 섹션 */}
                    {planData.estimated_budget && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">3. 실시간 가격 반영</h3>
                        </div>
                        <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800">
                        <p className="text-sm text-muted-foreground mb-4">
                          실제로 확인한 항공권 및 숙박 가격을 입력하면, 현지 지출 예산이 자동으로 재조정됩니다.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <Label htmlFor="realFlightCost">실제 항공권 가격 (원)</Label>
                            <Input
                              id="realFlightCost"
                              type="number"
                              placeholder="예: 1200000"
                              value={realFlightCost}
                              onChange={(e) => setRealFlightCost(e.target.value)}
                              disabled={rebalancing}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="realAccommodationCost">실제 숙박 총 비용 (원)</Label>
                            <Input
                              id="realAccommodationCost"
                              type="number"
                              placeholder="예: 500000"
                              value={realAccommodationCost}
                              onChange={(e) => setRealAccommodationCost(e.target.value)}
                              disabled={rebalancing}
                              className="h-10"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleRebalanceBudget}
                          disabled={rebalancing || !realFlightCost || !realAccommodationCost}
                          className="w-full md:w-auto"
                        >
                          {rebalancing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              재조정 중...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              예산 재조정
                            </>
                          )}
                        </Button>
                        {rebalanceError && (
                          <div className="mt-3 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                            {rebalanceError}
                          </div>
                        )}
                        {rebalanceSuccess && (
                          <div className="mt-3 p-3 bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-md">
                            예산이 성공적으로 재조정되었습니다.
                          </div>
                        )}
                        </div>
                      </div>
                    )}

                    {/* 4. 예산 분배 */}
                    {planData.estimated_budget && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">4. 예산 분배</h3>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(planData.estimated_budget.breakdown).map(([key, amount]) => {
                            if (amount <= 0) return null;
                            
                            const total = planData.estimated_budget.total_amount;
                            const percentage = ((amount / total) * 100).toFixed(1);
                            const labelMap: Record<string, string> = {
                              flight_cost: '왕복 항공/교통비',
                              accommodation_cost: '숙소 비용',
                              local_transport_cost: '현지 이동 비용',
                              food_and_drink_cost: '식비 및 음료',
                              activities_and_tours_cost: '관광 및 체험료',
                              contingency_and_misc: '예비비 및 쇼핑',
                              // 하위 호환성 (기존 필드)
                              food: '식비',
                              accommodation: '숙박',
                              transportation: '교통비',
                              activities: '관광지 및 체험',
                              misc: '기타',
                            };
                            
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium">{labelMap[key] || key}</span>
                                  <span className="text-muted-foreground">
                                    {amount.toLocaleString()}원 ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. 예산 사용 흐름 (누적 소비 그래프) */}
                    {planData.estimated_budget && planData.days.some(day => day.daily_estimated_cost) && (() => {
                      // 누적 데이터 배열 생성
                      const cumulativeData: { day: number; cumulative: number; daily: number; date: string }[] = [];
                      let runningTotal = 0;
                      
                      planData.days.forEach((day, index) => {
                        if (day.daily_estimated_cost) {
                          runningTotal += day.daily_estimated_cost;
                          cumulativeData.push({
                            day: index + 1,
                            cumulative: runningTotal,
                            daily: day.daily_estimated_cost,
                            date: day.date,
                          });
                        }
                      });

                      const maxCumulative = Math.max(...cumulativeData.map(d => d.cumulative), planData.estimated_budget.total_amount);
                      const graphHeight = 320;
                      const graphWidth = 600;
                      const padding = { top: 20, right: 40, bottom: 60, left: 60 };
                      const chartWidth = graphWidth - padding.left - padding.right;
                      const chartHeight = graphHeight - padding.top - padding.bottom;

                      // SVG 경로 생성 (꺾은선)
                      const points = cumulativeData.map((data, index) => {
                        const x = (index / (cumulativeData.length - 1 || 1)) * chartWidth + padding.left;
                        const y = chartHeight - (data.cumulative / maxCumulative) * chartHeight + padding.top;
                        return { x, y, ...data };
                      });

                      const pathD = points.length > 0
                        ? `M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`
                        : '';

                      return (
                        <div className="border-b pb-6 last:border-b-0">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-xl font-bold">5. 예산 사용 흐름</h3>
                          </div>
                          <div className="space-y-4">
                            <div className="relative w-full overflow-x-auto">
                              <svg
                                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                                className="w-full h-80 border rounded-lg bg-muted/20 p-4"
                                preserveAspectRatio="xMidYMid meet"
                              >
                                {/* 그리드 라인 */}
                                {[0, 25, 50, 75, 100].map((percent) => {
                                  const y = chartHeight - (percent / 100) * chartHeight + padding.top;
                                  return (
                                    <g key={percent}>
                                      <line
                                        x1={padding.left}
                                        y1={y}
                                        x2={graphWidth - padding.right}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeOpacity={0.1}
                                        strokeWidth={1}
                                      />
                                      <text
                                        x={padding.left - 10}
                                        y={y + 4}
                                        textAnchor="end"
                                        className="text-xs fill-muted-foreground"
                                      >
                                        {Math.round((maxCumulative * percent) / 100 / 10000)}만
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* 꺾은선 그래프 */}
                                {pathD && (
                                  <>
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke="url(#gradient)"
                                      strokeWidth={3}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <defs>
                                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                                        <stop offset="100%" stopColor="rgb(168, 85, 247)" />
                                      </linearGradient>
                                    </defs>
                                  </>
                                )}

                                {/* 데이터 포인트 및 툴팁 */}
                                {points.map((point, index) => (
                                  <g key={index} className="group">
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={4}
                                      fill="rgb(59, 130, 246)"
                                      className="transition-all group-hover:r-6"
                                    />
                                    {/* 툴팁 */}
                                    <foreignObject
                                      x={point.x - 60}
                                      y={point.y - 50}
                                      width="120"
                                      height="40"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    >
                                      <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                        {point.day}일차: {point.daily.toLocaleString()}원
                                        <br />
                                        누적: {point.cumulative.toLocaleString()}원
                                      </div>
                                    </foreignObject>
                                  </g>
                                ))}

                                {/* X축 라벨 */}
                                {points.map((point, index) => (
                                  <text
                                    key={index}
                                    x={point.x}
                                    y={graphHeight - padding.bottom + 20}
                                    textAnchor="middle"
                                    className="text-xs fill-muted-foreground"
                                  >
                                    {point.day}일
                                  </text>
                                ))}
                              </svg>
                            </div>
                            {/* 범례 */}
                            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                                <span>누적 소비액</span>
                              </div>
                            </div>
                            
                            {/* 요약 정보 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
                              <div>
                                <div className="text-xs text-muted-foreground">일평균 지출</div>
                                <div className="font-semibold">
                                  {(
                                    planData.days
                                      .filter(day => day.daily_estimated_cost)
                                      .reduce((sum, day) => sum + (day.daily_estimated_cost || 0), 0) /
                                    planData.days.filter(day => day.daily_estimated_cost).length
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">최대 일일 지출</div>
                                <div className="font-semibold">
                                  {Math.max(
                                    ...planData.days.map(day => day.daily_estimated_cost || 0)
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">최소 일일 지출</div>
                                <div className="font-semibold">
                                  {Math.min(
                                    ...planData.days
                                      .filter(day => day.daily_estimated_cost)
                                      .map(day => day.daily_estimated_cost || 0)
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">총 예상 비용</div>
                                <div className="font-semibold">
                                  {planData.estimated_budget.total_amount.toLocaleString()}원
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* 기존 예산 정보 (하위 호환성을 위해 유지) */}
                    {!planData.estimated_budget && planData.summary.budget && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">예산 분배</h3>
                        <div className="space-y-2">
                          {planData.summary.budget.accommodation && (
                            <div className="flex justify-between">
                              <span>숙박</span>
                              <span>{planData.summary.budget.accommodation.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.food && (
                            <div className="flex justify-between">
                              <span>식비</span>
                              <span>{planData.summary.budget.food.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.transportation && (
                            <div className="flex justify-between">
                              <span>교통비</span>
                              <span>{planData.summary.budget.transportation.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.attractions && (
                            <div className="flex justify-between">
                              <span>관광지</span>
                              <span>{planData.summary.budget.attractions.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.other && (
                            <div className="flex justify-between">
                              <span>기타</span>
                              <span>{planData.summary.budget.other.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.total && (
                            <div className="flex justify-between font-semibold pt-2 border-t">
                              <span>총 예산</span>
                              <span>{planData.summary.budget.total.toLocaleString()}원</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {planData.days.map((dayPlan, index) => {
              const dateLabel = format(parseISO(dayPlan.date), 'yyyy년 MM월 dd일 (E)', { locale: ko });
              return (
                <TabsContent
                  key={dayPlan.date}
                  value={`day-${index}`}
                  className="mt-0"
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                      <CardTitle className="text-xl">{dateLabel}</CardTitle>
                      <CardDescription>
                        {dayPlan.title || `${index + 1}일차 여행 계획`}
                      </CardDescription>
                        </div>
                        {dayPlan.daily_estimated_cost !== undefined && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground">당일 예상 지출</span>
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              {dayPlan.daily_estimated_cost.toLocaleString()}원
                            </span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {dayPlan.summary && (
                        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">{dayPlan.summary}</p>
                        </div>
                      )}
                      <div className="space-y-4">
                        {dayPlan.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="border-l-4 border-primary pl-4 py-2">
                            <div className="flex items-start gap-3">
                              <span className="font-semibold text-primary min-w-[60px]">
                                {item.time}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-medium">{item.place}</div>
                                <div className="text-muted-foreground mt-1">{item.activity}</div>
                                  </div>
                                  {item.cost !== undefined && item.cost > 0 && (
                                    <div className="flex-shrink-0">
                                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                        {item.cost.toLocaleString()}원
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {item.next_move_duration && (
                                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Navigation className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>다음 이동 예상 시간: {item.next_move_duration}</span>
                                  </div>
                                )}
                                {item.image_search_link && (
                                  <div className="mt-2">
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                    >
                                      <a
                                        href={item.image_search_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5"
                                      >
                                        <Image className="h-3.5 w-3.5" />
                                        <span>사진 보기</span>
                                      </a>
                                    </Button>
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-sm text-muted-foreground mt-1 italic">
                                    💡 {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlanResultPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-8 max-w-4xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">결과를 불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PlanResultContent />
    </Suspense>
  );
}

