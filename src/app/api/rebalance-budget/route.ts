import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { originalBudget, realFlightCost, realAccommodationCost } = body || {};

    // 유효성 검증
    if (!originalBudget || !originalBudget.total_amount) {
      return NextResponse.json(
        { error: '기존 예산 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    if (typeof realFlightCost !== 'number' || realFlightCost < 0) {
      return NextResponse.json(
        { error: '유효한 항공권 가격을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (typeof realAccommodationCost !== 'number' || realAccommodationCost < 0) {
      return NextResponse.json(
        { error: '유효한 숙박 비용을 입력해주세요.' },
        { status: 400 }
      );
    }

    const originalBreakdown = originalBudget.breakdown || {};
    
    // 기존 현지 지출 비용 추출 (항공/숙박 제외한 나머지 4개 항목)
    const existingLocalExpenses = {
      local_transport_cost: originalBreakdown.local_transport_cost || 0,
      food_and_drink_cost: originalBreakdown.food_and_drink_cost || 0,
      activities_and_tours_cost: originalBreakdown.activities_and_tours_cost || 0,
      contingency_and_misc: originalBreakdown.contingency_and_misc || 0,
    };

    // 새로운 총 예산 계산
    // 새로운 총 예산 = 실제 항공 + 실제 숙박 + 기존의 4개 현지 지출 비용
    const newTotalBudget =
      realFlightCost +
      realAccommodationCost +
      existingLocalExpenses.local_transport_cost +
      existingLocalExpenses.food_and_drink_cost +
      existingLocalExpenses.activities_and_tours_cost +
      existingLocalExpenses.contingency_and_misc;

    // 최종 breakdown 구성 (항공/숙박만 교체, 나머지는 기존 값 유지)
    const newBreakdown = {
      flight_cost: realFlightCost,
      accommodation_cost: realAccommodationCost,
      ...existingLocalExpenses,
    };

    // 새로운 estimated_budget 객체 구성
    const newEstimatedBudget = {
      total_amount: newTotalBudget,
      currency: originalBudget.currency || 'KRW',
      breakdown: newBreakdown,
    };

    const originalTotalBudget = originalBudget.total_amount || 0;
    console.log(`[예산 재조정] 기존 총 예산: ${originalTotalBudget.toLocaleString()}원 -> 새로운 총 예산: ${newTotalBudget.toLocaleString()}원`);
    console.log(`[예산 재조정] 항공/숙박만 변경, 나머지 비용 유지. 차이: ${(newTotalBudget - originalTotalBudget).toLocaleString()}원`);

    return NextResponse.json(
      {
        estimated_budget: newEstimatedBudget,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('예산 재조정 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

