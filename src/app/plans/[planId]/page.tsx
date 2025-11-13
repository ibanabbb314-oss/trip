import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, DollarSign, MapPin, Edit } from 'lucide-react';
import db, { ensureDatabaseInitialized } from '@/lib/db';
import { format } from 'date-fns';

async function getPlan(planId: string) {
  ensureDatabaseInitialized();
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  return plan;
}

async function getScheduleItems(planId: string) {
  ensureDatabaseInitialized();
  const items = db
    .prepare('SELECT * FROM schedule_items WHERE plan_id = ? ORDER BY date, order_index')
    .all(planId);
  return items;
}

async function getBudgetAllocations(planId: string) {
  ensureDatabaseInitialized();
  const allocations = db
    .prepare('SELECT * FROM budget_allocations WHERE plan_id = ?')
    .all(planId);
  return allocations;
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  const scheduleItems = await getScheduleItems(planId);
  const budgetAllocations = await getBudgetAllocations(planId);

  if (!plan) {
    notFound();
  }

  const planData = plan as any;

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{planData.destination}</h1>
          <p className="text-muted-foreground mt-2">
            {planData.start_date && format(new Date(planData.start_date), 'yyyy년 MM월 dd일')} ~{' '}
            {planData.end_date && format(new Date(planData.end_date), 'yyyy년 MM월 dd일')} (
            {planData.duration}일)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/plans/${planId}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            수정하기
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">일정</TabsTrigger>
          <TabsTrigger value="budget">예산</TabsTrigger>
          <TabsTrigger value="places">장소</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>여행 일정</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleItems.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(
                    scheduleItems.reduce((acc: any, item: any) => {
                      const date = item.date;
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(item);
                      return acc;
                    }, {})
                  ).map(([date, items]: [string, any]) => (
                    <div key={date} className="space-y-3">
                      <h3 className="font-semibold text-lg">
                        {format(new Date(date), 'yyyy년 MM월 dd일')}
                      </h3>
                      <div className="space-y-2 pl-4 border-l-2">
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-start space-x-4 py-2">
                            <div className="text-sm font-medium text-muted-foreground min-w-[60px]">
                              {item.time || '시간 미정'}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{item.place_name}</div>
                              {item.address && (
                                <div className="text-sm text-muted-foreground flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {item.address}
                                </div>
                              )}
                              {item.place_type && (
                                <span className="inline-block mt-1 text-xs px-2 py-1 bg-muted rounded">
                                  {item.place_type}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">일정이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>예산 배분</CardTitle>
              <CardDescription>
                총 예산: {planData.budget?.toLocaleString()}원
              </CardDescription>
            </CardHeader>
            <CardContent>
              {budgetAllocations.length > 0 ? (
                <div className="space-y-4">
                  {budgetAllocations.map((allocation: any) => {
                    const percentage = (allocation.allocated_amount / planData.budget) * 100;
                    return (
                      <div key={allocation.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{allocation.category}</span>
                          <span className="text-sm text-muted-foreground">
                            {allocation.allocated_amount.toLocaleString()}원 ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">예산 배분 정보가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="places" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>추천 장소</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                일정에 포함된 장소들을 확인할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

