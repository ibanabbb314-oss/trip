import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';

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

    const originalTotalBudget = originalBudget.total_amount;
    const originalBreakdown = originalBudget.breakdown || {};
    
    // AI 추정 항공 비용과 숙박 비용 추출
    const estimatedFlightCost = originalBreakdown.flight_cost || 0;
    const estimatedAccommodationCost = originalBreakdown.accommodation_cost || 0;
    
    // 기존 현지 지출 계산 (기존 총 예산 - AI 추정 항공 - AI 추정 숙박)
    const originalLocalExpenses = 
      originalTotalBudget - estimatedFlightCost - estimatedAccommodationCost;
    
    // 새로운 현지 지출 잔액 계산
    // 잔액 = 기존 총 예산 - 실제 항공 - 실제 숙박
    const calculatedRemainingBudget = originalTotalBudget - realFlightCost - realAccommodationCost;

    // 최소 현지 지출 보장 (음수 방지)
    if (calculatedRemainingBudget < 0) {
      return NextResponse.json(
        { error: '입력한 항공권 및 숙박 비용이 총 예산을 초과합니다. 최소 현지 지출 예산을 확보할 수 없습니다.' },
        { status: 400 }
      );
    }

    // AI 프롬프트 구성
    const prompt = `
당신은 전문 여행 예산 조정 전문가입니다. 아래 요구사항에 따라 현지 지출 예산을 재분배하여 JSON 형식으로만 응답해주세요.

**중요: 반드시 유효한 JSON만 출력하세요. 마크다운 코드블럭, 설명, 주석 없이 순수 JSON만 출력하세요.**

**현지 지출 재분배 요구사항:**

현재 남은 현지 지출 잔액: ${calculatedRemainingBudget.toLocaleString()}원

이 잔액(${calculatedRemainingBudget.toLocaleString()}원)을 다음 4개 현지 카테고리에 합리적으로 분배하세요:
- local_transport_cost (현지 이동 비용)
- food_and_drink_cost (식비 및 음료)
- activities_and_tours_cost (관광 및 체험료)
- contingency_and_misc (예비비 및 쇼핑)

**요구사항:**
- 4개 카테고리의 합계가 잔액(${calculatedRemainingBudget.toLocaleString()}원)과 정확히 일치해야 합니다
- 각 카테고리는 0원 이상이어야 하며, 여행 특성에 맞게 합리적으로 분배하세요
- 식비는 일일 평균 비용을 고려하여 계산하세요
- 현지 이동 비용은 목적지와 여행 기간을 고려하여 계산하세요
- 관광 및 체험료는 목적지의 주요 관광지 입장료와 체험 비용을 반영하세요
- 예비비는 예상치 못한 지출과 소액 쇼핑을 위한 여유 비용입니다

**JSON 응답 형식 (현지 지출 4개 항목만 포함):**
{
  "local_transport_cost": 0,
  "food_and_drink_cost": 0,
  "activities_and_tours_cost": 0,
  "contingency_and_misc": 0
}

**검증:**
- local_transport_cost + food_and_drink_cost + activities_and_tours_cost + contingency_and_misc = ${calculatedRemainingBudget.toLocaleString()}원
- 모든 값은 정수(원 단위)로 응답하세요
`.trim();

    // AI 호출
    const raw = await generateText({
      prompt,
      json: false,
    });

    // JSON 파싱
    let parsed: any;
    try {
      let cleaned = raw.trim();

      // 마크다운 코드블럭 제거
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

    // AI 응답에서 현지 지출 4개 항목 추출
    const localExpenses = parsed.local_transport_cost !== undefined
      ? {
          local_transport_cost: parsed.local_transport_cost || 0,
          food_and_drink_cost: parsed.food_and_drink_cost || 0,
          activities_and_tours_cost: parsed.activities_and_tours_cost || 0,
          contingency_and_misc: parsed.contingency_and_misc || 0,
        }
      : parsed.breakdown
        ? {
            local_transport_cost: parsed.breakdown.local_transport_cost || 0,
            food_and_drink_cost: parsed.breakdown.food_and_drink_cost || 0,
            activities_and_tours_cost: parsed.breakdown.activities_and_tours_cost || 0,
            contingency_and_misc: parsed.breakdown.contingency_and_misc || 0,
          }
        : null;

    if (!localExpenses) {
      return NextResponse.json(
        { error: '유효하지 않은 현지 지출 구조', parsed },
        { status: 500 }
      );
    }

    // 현지 지출 합계 검증
    const localSum =
      localExpenses.local_transport_cost +
      localExpenses.food_and_drink_cost +
      localExpenses.activities_and_tours_cost +
      localExpenses.contingency_and_misc;

    // 합계가 잔액과 일치하는지 확인 (1000원 오차 허용)
    const diff = Math.abs(localSum - calculatedRemainingBudget);
    if (diff > 1000) {
      console.warn(`현지 지출 합계 불일치: ${localSum} vs ${calculatedRemainingBudget}`);
      // 차이를 예비비에 조정
      const adjustment = calculatedRemainingBudget - localSum;
      localExpenses.contingency_and_misc = Math.max(0, localExpenses.contingency_and_misc + adjustment);
    }

    // 새로운 총 예산 계산
    // 새로운 총 예산 = 실제 항공 + 실제 숙박 + 재분배된 현지 지출
    const newTotalBudget =
      realFlightCost +
      realAccommodationCost +
      localExpenses.local_transport_cost +
      localExpenses.food_and_drink_cost +
      localExpenses.activities_and_tours_cost +
      localExpenses.contingency_and_misc;

    // 최종 breakdown 구성
    const newBreakdown = {
      flight_cost: realFlightCost,
      accommodation_cost: realAccommodationCost,
      ...localExpenses,
    };

    // 새로운 estimated_budget 객체 구성
    const newEstimatedBudget = {
      total_amount: newTotalBudget,
      currency: originalBudget.currency || 'KRW',
      breakdown: newBreakdown,
    };

    console.log(`[예산 재조정] 기존 총 예산: ${originalTotalBudget.toLocaleString()}원 -> 새로운 총 예산: ${newTotalBudget.toLocaleString()}원`);
    console.log(`[예산 재조정] 차이: ${(newTotalBudget - originalTotalBudget).toLocaleString()}원`);

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

