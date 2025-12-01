import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';

interface TransportCostRequest {
  destination: string;
  route: string[]; // 경로상의 장소 목록 (순서대로)
  people: number;
}

export async function POST(req: Request) {
  try {
    const body: TransportCostRequest = await req.json();
    const { destination, route, people } = body;

    if (!destination || !route || route.length < 2) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었거나 경로가 유효하지 않습니다.' },
        { status: 400 }
      );
    }

    // 경로를 문자열로 변환
    const routeString = route.join(' → ');

    // AI 프롬프트 생성
    const prompt = `
당신은 여행 전문가입니다. 다음 경로의 현지 이동비를 정확하게 계산해주세요.

**여행지:** ${destination}
**인원:** ${people}명
**경로:** ${routeString}

**계산 방법:**
1. Google Search를 사용하여 ${destination}의 대중교통 요금 정보를 검색하세요
2. 각 구간(장소 간 이동)의 거리와 적절한 교통수단을 판단하세요
3. 각 구간의 이동비를 계산하세요:
   - 지하철/전철: ${destination}의 지하철 요금 기준
   - 버스: ${destination}의 버스 요금 기준
   - 택시: 거리와 ${destination}의 택시 요금 기준
   - 도보: 0원 (1km 이내)
4. 모든 구간의 이동비를 합산하여 총 현지 이동비를 계산하세요

**검색 키워드 예시:**
- "${destination} 지하철 요금"
- "${destination} 버스 요금"
- "${destination} 택시 요금"
- "${destination} 대중교통 비용"

**응답 형식 (JSON만 출력, 마크다운 코드블럭 없이):**
{
  "total_cost": 0,
  "breakdown": [
    {
      "from": "장소1",
      "to": "장소2",
      "transport": "지하철",
      "cost": 0
    }
  ]
}

**중요:**
- 2024-2025년 기준 최신 요금 정보를 사용하세요
- 한국 원화(KRW) 기준으로 환산하세요
- 총 이동비는 모든 구간의 이동비 합계입니다
`;

    try {
      const response = await generateText({
        prompt,
        json: true,
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
        console.error('[현지 이동비 계산] JSON 파싱 오류:', parseError);
        console.error('[현지 이동비 계산] 응답:', response);
        // 파싱 실패 시 기본값 반환
        return NextResponse.json({
          total_cost: 0,
          breakdown: [],
        });
      }

      const totalCost = Math.max(0, Math.round(parsedResponse.total_cost || 0));
      const breakdown = Array.isArray(parsedResponse.breakdown) 
        ? parsedResponse.breakdown.map((item: any) => ({
            from: item.from || '',
            to: item.to || '',
            transport: item.transport || '',
            cost: Math.max(0, Math.round(item.cost || 0)),
          }))
        : [];

      return NextResponse.json({
        total_cost: totalCost,
        breakdown,
      });
    } catch (error) {
      console.error('[현지 이동비 계산] 오류:', error);
      return NextResponse.json(
        {
          error: '현지 이동비 계산 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[현지 이동비 계산] 요청 오류:', error);
    return NextResponse.json(
      {
        error: '잘못된 요청입니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}

