import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';
import { createSearchContext } from '@/lib/searchHelper';

interface EstimateActivityCostRequest {
  destination: string;
  activities: Array<{
    place: string;
    activity: string;
    notes?: string;
  }>;
  people?: number;
}

export async function POST(req: Request) {
  try {
    const body: EstimateActivityCostRequest = await req.json();
    const { destination, activities, people = 1 } = body;

    if (!destination || !activities || activities.length === 0) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 검색 컨텍스트 생성
    const searchContext = createSearchContext({
      destination,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      people,
    });

    // 활동 목록 정리
    const activitiesList = activities
      .map((item) => `${item.place}에서 ${item.activity}${item.notes ? ` (${item.notes})` : ''}`)
      .join('\n- ');

    // AI 프롬프트 생성
    const prompt = `
당신은 전문 여행 비용 산정 전문가입니다. 아래 활동에 대한 현실적인 예상 비용을 한국 원화(KRW) 기준으로 산정해주세요.

**여행지:** ${destination}
**인원:** ${people}명

**활동 목록:**
- ${activitiesList}

**비용 산정 규칙:**
1. 각 활동에 대해 다음 비용 항목을 고려하여 총 비용을 산정하세요:
   - 입장료/티켓 비용 (해당하는 경우)
   - 체험 프로그램 비용 (해당하는 경우)
   - 식사/음료 비용 (해당하는 경우)
   - 교통비 (해당하는 경우)
   - 기타 비용

2. 각 활동의 비용은 1인당 비용에 인원수를 곱하여 계산하세요.

3. 비용이 없는 활동 (예: 무료 공원 방문, 무료 거리 산책 등)은 0원으로 산정하세요.

4. 공항 도착/출발, 체크인/체크아웃, 이동 등 일상 활동은 대부분 0원입니다.

5. 최신 2024-2025년 기준 물가 정보를 사용하세요.

**응답 형식 (JSON만 출력, 마크다운 코드블럭 없이):**
{
  "costs": [
    {
      "activity_index": 0,
      "cost": 0,
      "breakdown": {
        "entrance_fee": 0,
        "experience_program": 0,
        "food_drink": 0,
        "transport": 0,
        "other": 0
      }
    }
  ]
}

**중요:**
- 각 활동의 인덱스는 요청된 activities 배열의 인덱스와 일치해야 합니다.
- cost는 breakdown의 모든 항목 합계입니다.
- 반드시 유효한 JSON만 출력하세요.
`;

    try {
      const response = await generateText({
        prompt,
        json: true,
        searchContext,
        enableSearch: true,
      });

      // JSON 파싱
      let parsedResponse;
      try {
        const cleanedResponse = response
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        parsedResponse = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[활동 비용 산정] JSON 파싱 오류:', parseError);
        console.error('[활동 비용 산정] 응답:', response);
        // 파싱 실패 시 기본값 반환
        return NextResponse.json({
          costs: activities.map((_, index) => ({
            activity_index: index,
            cost: 0,
            breakdown: {
              entrance_fee: 0,
              experience_program: 0,
              food_drink: 0,
              transport: 0,
              other: 0,
            },
          })),
        });
      }

      // 응답 검증 및 정리
      const costs = Array.isArray(parsedResponse.costs)
        ? parsedResponse.costs.map((item: any) => ({
            activity_index: Math.max(0, Math.min(activities.length - 1, Math.round(item.activity_index || 0))),
            cost: Math.max(0, Math.round(item.cost || 0)),
            breakdown: {
              entrance_fee: Math.max(0, Math.round(item.breakdown?.entrance_fee || 0)),
              experience_program: Math.max(0, Math.round(item.breakdown?.experience_program || 0)),
              food_drink: Math.max(0, Math.round(item.breakdown?.food_drink || 0)),
              transport: Math.max(0, Math.round(item.breakdown?.transport || 0)),
              other: Math.max(0, Math.round(item.breakdown?.other || 0)),
            },
          }))
        : activities.map((_, index) => ({
            activity_index: index,
            cost: 0,
            breakdown: {
              entrance_fee: 0,
              experience_program: 0,
              food_drink: 0,
              transport: 0,
              other: 0,
            },
          }));

      // 인덱스별로 정렬
      costs.sort((a, b) => a.activity_index - b.activity_index);

      return NextResponse.json({
        costs,
      });
    } catch (error) {
      console.error('[활동 비용 산정] 오류:', error);
      // 오류 발생 시 기본값 반환
      return NextResponse.json({
        costs: activities.map((_, index) => ({
          activity_index: index,
          cost: 0,
          breakdown: {
            entrance_fee: 0,
            experience_program: 0,
            food_drink: 0,
            transport: 0,
            other: 0,
          },
        })),
      });
    }
  } catch (error) {
    console.error('[활동 비용 산정] 요청 오류:', error);
    return NextResponse.json(
      {
        error: '잘못된 요청입니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}

