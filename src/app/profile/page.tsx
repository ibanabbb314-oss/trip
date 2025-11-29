'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, MapPin, Calendar, DollarSign, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { useRouter } from 'next/navigation';

interface SavedPlan {
  planId: string;
  destination: string;
  startDate: string;
  endDate: string;
  estimated_budget?: {
    total_amount: number;
    currency: string;
  };
  savedAt: number;
  data: any;
}

export default function ProfilePage() {
  const router = useRouter();
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  useEffect(() => {
    // localStorage에서 모든 저장된 계획 가져오기
    const plans: SavedPlan[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tripgenie_plan_')) {
        try {
          const planData = JSON.parse(localStorage.getItem(key) || '{}');
          if (planData.planId && planData.destination) {
            plans.push({
              planId: planData.planId,
              destination: planData.destination,
              startDate: planData.startDate || '',
              endDate: planData.endDate || '',
              estimated_budget: planData.estimated_budget,
              savedAt: planData.savedAt || Date.now(),
              data: planData,
            });
          }
        } catch (error) {
          console.error('Failed to parse saved plan:', error);
        }
      }
    }
    
    // 저장 시간 기준으로 정렬 (최신순)
    plans.sort((a, b) => b.savedAt - a.savedAt);
    setSavedPlans(plans);
  }, []);

  const handleDeletePlan = (planId: string) => {
    if (confirm('정말로 이 여행 계획을 삭제하시겠습니까?')) {
      const key = `tripgenie_plan_${planId}`;
      localStorage.removeItem(key);
      setSavedPlans(savedPlans.filter(plan => plan.planId !== planId));
    }
  };

  const handleViewPlan = (plan: SavedPlan) => {
    // 계획 데이터를 localStorage에 임시 저장
    const tempKey = `temp_plan_${Date.now()}`;
    localStorage.setItem(tempKey, JSON.stringify(plan.data));
    
    // plan-result 페이지로 이동
    router.push(`/plan-result?key=${tempKey}`);
  };

  return (
    <div className="container py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>내 프로필</CardTitle>
          <CardDescription>
            저장된 여행 계획을 관리하고 확인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {savedPlans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                아직 저장된 여행 계획이 없습니다.
              </p>
              <Button asChild>
                <a href="/home">새 여행 계획 만들기</a>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPlans.map((plan) => (
                <Card key={plan.planId} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {plan.destination}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          {plan.startDate && plan.endDate && (
                            <>
                              {format(new Date(plan.startDate), 'yyyy.MM.dd', { locale: ko })} -{' '}
                              {format(new Date(plan.endDate), 'yyyy.MM.dd', { locale: ko })}
                            </>
                          )}
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {plan.estimated_budget && (
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                          <DollarSign className="h-4 w-4" />
                          {plan.estimated_budget.total_amount.toLocaleString()}{' '}
                          {plan.estimated_budget.currency}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        저장일: {format(new Date(plan.savedAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleViewPlan(plan)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          계획 보기
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeletePlan(plan.planId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

