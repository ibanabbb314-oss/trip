import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';

interface GapScheduleRequest {
  destination: string;
  gapStartTime: string; // HH:MM 형식
  gapEndTime: string; // HH:MM 형식
  date: string; // YYYY-MM-DD 형식
  existingSchedule: Array<{
    time: string;
    place: string;
    activity: string;
    priority_score?: number;
  }>;
  allPlaces?: Array<{
    place: string;
    activity: string;
    priority_score?: number;
  }>; // 전체 일정의 모든 장소 목록 (중복 제거)
  budget: {
    total_amount: number;
    breakdown: {
      food_and_drink_cost?: number;
      activities_and_tours_cost?: number;
      local_transport_cost?: number;
    };
  };
}

export async function POST(req: Request) {
  try {
    const body: GapScheduleRequest = await req.json();
    const { destination, gapStartTime, gapEndTime, date, existingSchedule, budget, allPlaces } = body;

    // 유효성 검증
    if (!destination || !gapStartTime || !gapEndTime || !date) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 시간 계산 (분 단위)
    const [startHour, startMin] = gapStartTime.split(':').map(Number);
    const [endHour, endMin] = gapEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const gapMinutes = endMinutes - startMinutes;

    // 공백 시간이 1시간 미만이면 일정 생성 불필요
    if (gapMinutes < 60) {
      return NextResponse.json({
        items: [],
        totalCost: 0,
      });
    }

    // 공백 시간을 시간 단위로 변환 (소수점 1자리)
    const gapHours = Math.round(gapMinutes / 6) / 10; // 6분 단위로 반올림

    // 기존 일정 요약
    const existingScheduleSummary = existingSchedule
      .slice(-3) // 마지막 3개 일정만 참고
      .map(item => `${item.time} ${item.place}에서 ${item.activity}`)
      .join(', ');
    
    // 전체 일정에 포함된 장소 목록 (중복 제거)
    const existingPlacesSet = new Set<string>();
    const existingPlacesList: string[] = [];
    
    if (allPlaces && Array.isArray(allPlaces)) {
      allPlaces.forEach((place) => {
        const key = `${place.place}|${place.activity}`;
        if (!existingPlacesSet.has(key)) {
          existingPlacesSet.add(key);
          existingPlacesList.push(`${place.place} (${place.activity})`);
        }
      });
    }
    
    // 기존 일정의 장소도 포함
    existingSchedule.forEach((item) => {
      if (item.place && item.place.trim() !== '') {
        const key = `${item.place}|${item.activity}`;
        if (!existingPlacesSet.has(key)) {
          existingPlacesSet.add(key);
          existingPlacesList.push(`${item.place} (${item.activity})`);
        }
      }
    });
    
    const existingPlacesSummary = existingPlacesList.length > 0 
      ? `\n- 이미 포함된 장소 목록: ${existingPlacesList.slice(0, 10).join(', ')}${existingPlacesList.length > 10 ? ` 외 ${existingPlacesList.length - 10}개` : ''}\n- 위 목록에 포함된 장소는 제외하고, 중요도 높은 새로운 장소를 우선 추가하세요.`
      : '';

    // 예산 정보 추출
    const availableBudget = Math.round(
      (budget.breakdown.food_and_drink_cost || 0) * 0.3 + // 식비의 30%
      (budget.breakdown.activities_and_tours_cost || 0) * 0.2 + // 관광비의 20%
      (budget.breakdown.local_transport_cost || 0) * 0.1 // 교통비의 10%
    );

    // AI 프롬프트 생성
    const prompt = `
당신은 전문 여행 플래너입니다. 아래 조건에 맞는 시간 공백(Gap) 일정을 생성해주세요.

**조건:**
- 여행지: ${destination}
- 날짜: ${date}
- 공백 시간: ${gapStartTime} ~ ${gapEndTime} (약 ${gapHours}시간)
- 예산: 약 ${availableBudget.toLocaleString()}원
- 기존 일정 마지막 활동: ${existingScheduleSummary || '없음'}${existingPlacesSummary}

**일정 생성 규칙 (장소 중요도 기반):**
1. 공백 시간 내에서 ${gapHours >= 2 ? '2~3개' : '1~2개'}의 활동을 생성하세요
2. **장소 중요도 우선순위 (핵심 원칙):**
   - 우선순위 1: 아직 일정에 포함되지 않은 중요도 높은 장소(Priority Score 60점 이상)를 우선적으로 추가
   - 우선순위 2: 중요도가 중간인 장소(Priority Score 40~59점) 중 시간에 맞는 장소
   - 우선순위 3: 중요도가 낮은 일상 활동(기념품 쇼핑, 식사, 휴식 등, Priority Score 20점 미만)
3. **기존 장소 제외 규칙:** 기존 일정에 이미 포함된 장소는 절대 제안하지 마세요. 중요도가 높으면서 아직 방문하지 않은 새로운 장소를 우선 고려하세요
4. 공항으로 이동해야 하므로 마지막 활동은 공항 접근이 용이한 곳이어야 합니다
5. 각 활동의 소요 시간을 고려하여 시간표를 만들어주세요
6. 예산 내에서 현실적인 활동을 제안하세요
7. 각 생성된 일정 항목에 priority_score 필드를 포함하여 장소 중요도를 평가하세요 (0~100점)
   - 관광지/명소: 40~90점 범위로 평가
   - 일상 활동(식사, 쇼핑, 휴식): 10~30점 범위로 평가

**응답 형식 (JSON만 출력, 마크다운 코드블럭 없이):**
{
  "items": [
    {
      "time": "HH:MM",
      "place": "장소명",
      "place_id": "",
      "activity": "활동 내용",
      "notes": "추가 정보 (선택)",
      "cost": 0,
      "next_move_duration": "이동 시간 (예: 도보 10분, 택시 15분)",
      "priority_score": 0,
      "image_search_link": "",
      "activity_image_query": "",
      "official_website_link": "",
      "purchase_search_link": ""
    }
  ]
}

**링크 및 Place ID 생성 규칙 (기존 일정 생성 로직과 동일):**
- **Google Place ID (선택사항이지만 가능하면 생성):**
  - 각 item에 place_id 필드를 포함하세요.
  - Google Search Tool/Google Maps 검색을 사용하여 해당 장소의 Google Place ID를 찾으세요.
  - 정확한 Place ID를 찾을 수 없는 경우 place_id는 빈 문자열("")로 두세요.
- **이미지 검색 링크 및 이미지 쿼리 (선택사항):**
  - 실제 구체적인 장소나 관광지가 있는 활동에만 이미지 검색 링크를 생성하세요
  - 이미지 검색 링크를 생성해야 하는 활동: 관광지, 박물관, 공원, 특정 건축물, 유명 명소, 특정 카페나 식당 이름 등
  - 이미지 검색 링크를 생성하지 않아야 하는 활동: "휴식", "자유 시간", "쇼핑", "식사", "공항으로 이동", "체크아웃", "출발", "도착" 등 일반적인 활동
  - 링크 생성 형식: https://www.google.com/search?q={장소명}+${destination}+여행&tbm=isch
  - activity_image_query: 이미지 검색 링크가 있으면 해당 명소의 영어 이름을 포함한 검색어를 반환하세요. 형식: "{place 이름} {destination} {키워드}" (예: "Brandenburg Gate Berlin exterior photograph")

- **공식 웹사이트 및 티켓 검색 링크:**
  - 예약/티켓 구매가 필요한 활동만: official_website_link와 purchase_search_link 두 필드 모두를 반환합니다
  - 예약/티켓 구매가 필요한 활동 예시: 박물관, 테마파크, 공연장, 특별 체험 프로그램, 전시회, 뮤지컬, 콘서트, 유료 투어 프로그램, 스카이덱 입장 등
  - 예약이 불필요한 활동: 무료 공원, 무료 거리 산책, 무료 광장 방문, 일반적인 카페 방문, 식사, 휴식, 이동 등
  - official_website_link: 해당 활동의 공식 웹사이트 URL (정보 획득 목적)
  - purchase_search_link: Klook 검색 URL 형식: https://www.klook.com/ko/search?query={활동 이름} (활동 이름은 URL 인코딩)
  - 공항 관련 활동에는 절대 이미지 검색 링크, 공식 웹사이트 링크, 티켓 검색 링크를 생성하지 마세요

**비용 산정 규칙:**
- 각 항목의 cost는 다음 비용을 모두 포함해야 합니다:
  * 해당 활동 자체의 비용 (관광지 입장료, 식사 비용, 쇼핑 비용 등)
  * 이전 장소에서 현재 장소로 이동하는 현지 이동비 (지하철, 버스, 택시, 도보 이동 비용 등)
    - next_move_duration이 "지하철", "버스", "택시" 등 교통수단을 포함하는 경우, 해당 이동비를 cost에 반드시 포함
    - 이동비 기준: 지하철/버스 약 1,500~3,000원, 택시 약 5,000~15,000원 (거리별), 도보는 0원
  * 첫 번째 항목의 경우 기존 일정 마지막 장소에서의 이동비를 포함

**중요:**
- 시간은 ${gapStartTime} 이후부터 ${gapEndTime} 이전까지 배치하세요
- 마지막 활동은 ${gapEndTime} 이전에 종료되어야 합니다 (공항 이동 시간 고려)
- 각 활동 사이에 이동 시간을 고려하세요
- cost는 예산 내에서 현실적인 금액으로 설정하세요 (활동 비용 + 이동비 포함)
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
        // 마크다운 코드블럭 제거
        const cleanedResponse = response
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        parsedResponse = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[시간 공백 일정 생성] JSON 파싱 오류:', parseError);
        console.error('[시간 공백 일정 생성] 응답:', response);
        // 파싱 실패 시 빈 일정 반환
        return NextResponse.json({
          items: [],
          totalCost: 0,
        });
      }

      // 응답 검증 및 정리
      const items = Array.isArray(parsedResponse.items) ? parsedResponse.items : [];
      const validItems = items
        .filter((item: any) => item.time && item.place && item.activity)
        .map((item: any) => ({
          time: item.time,
          place: item.place,
          place_id: typeof item.place_id === 'string' ? item.place_id : '',
          activity: item.activity,
          notes: item.notes || '',
          cost: Math.max(0, Math.round(item.cost || 0)),
          next_move_duration: item.next_move_duration || '',
          priority_score: Math.max(0, Math.min(100, Math.round(item.priority_score || 20))), // 기본값 20점 (낮은 중요도)
          image_search_link: item.image_search_link || '',
          activity_image_query: item.activity_image_query || '',
          official_website_link: item.official_website_link || '',
          purchase_search_link: item.purchase_search_link || '',
        }));

      // 총 비용 계산
      const totalCost = validItems.reduce((sum, item) => sum + (item.cost || 0), 0);

      return NextResponse.json({
        items: validItems,
        totalCost,
      });
    } catch (error) {
      console.error('[시간 공백 일정 생성] 오류:', error);
      return NextResponse.json(
        {
          error: '일정 생성 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[시간 공백 일정 생성] 요청 오류:', error);
    return NextResponse.json(
      {
        error: '잘못된 요청입니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}
