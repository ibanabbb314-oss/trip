import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, DollarSign, Users } from 'lucide-react';
import db, { ensureDatabaseInitialized } from '@/lib/db';
import { format } from 'date-fns';

async function getAllPlans() {
  ensureDatabaseInitialized();
  const plans = db.prepare('SELECT * FROM plans ORDER BY created_at DESC').all();
  return plans;
}

export default async function PlansPage() {
  const plans = await getAllPlans();

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">내 여행 계획</h1>
        <Button asChild>
          <Link href="/plans/create">
            <Plus className="mr-2 h-4 w-4" />
            새 계획 만들기
          </Link>
        </Button>
      </div>

      {plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: any) => (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl">{plan.destination}</CardTitle>
                <CardDescription>
                  {plan.start_date && format(new Date(plan.start_date), 'yyyy년 MM월 dd일')} ~{' '}
                  {plan.end_date && format(new Date(plan.end_date), 'yyyy년 MM월 dd일')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    {plan.duration}일 여행
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    {plan.travelers}명
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="mr-2 h-4 w-4" />
                    {plan.budget?.toLocaleString()}원
                  </div>
                  <div className="pt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/plans/${plan.id}`}>상세 보기</Link>
                    </Button>
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/plans/${plan.id}/schedule`}>일정 보기</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground text-lg">아직 생성된 계획이 없습니다.</p>
          <Button asChild>
            <Link href="/plans/create">
              <Plus className="mr-2 h-4 w-4" />
              첫 여행 계획 만들기
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

