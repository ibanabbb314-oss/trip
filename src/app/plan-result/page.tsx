'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, X, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

interface DayItem {
  time: string;
  place: string;
  activity: string;
  notes?: string;
}

interface DayPlan {
  date: string;
  title: string;
  summary: string;
  items: DayItem[];
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
}

interface PlanData {
  planId: string;
  destination: string;
  startDate: string;
  endDate: string;
  summary: Summary;
  days: DayPlan[];
}

function PlanResultContent() {
  const searchParams = useSearchParams();
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const hasLoadedRef = useRef(false);

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
            <div>
              <CardTitle className="text-2xl">{planData.destination} 여행 계획</CardTitle>
              <CardDescription className="mt-2">
                전체 요약 및 {planData.days.length}일간의 맞춤형 여행 계획입니다.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? '복사됨!' : '전체 복사'}
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-11 h-auto mb-6 overflow-x-auto">
              <TabsTrigger
                value="summary"
                className="text-xs md:text-sm px-2 md:px-3 py-2 whitespace-nowrap"
              >
                전체 요약
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
            
            <TabsContent value="summary" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">전체 요약</CardTitle>
                  <CardDescription>
                    여행 전반에 대한 정보 및 예산, 팁 등
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {planData.summary.overview && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">여행지 개요</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {planData.summary.overview}
                        </p>
                      </div>
                    )}
                    
                    {planData.summary.budget && (
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
                    
                    {planData.summary.tips && planData.summary.tips.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">여행 팁</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          {planData.summary.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {planData.summary.notes && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">주의사항</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {planData.summary.notes}
                        </p>
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
                      <CardTitle className="text-xl">{dateLabel}</CardTitle>
                      <CardDescription>
                        {dayPlan.title || `${index + 1}일차 여행 계획`}
                      </CardDescription>
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
                                <div className="font-medium">{item.place}</div>
                                <div className="text-muted-foreground mt-1">{item.activity}</div>
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

