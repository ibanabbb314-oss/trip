import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';
import { createSearchContext } from '@/lib/searchHelper';
import { createExternalLinks } from '@/lib/externalLinks';
import { getIataCode } from '@/lib/iataCodeHelper';
import { format, addDays, parseISO } from 'date-fns';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, startDate, endDate, people } = body || {};
    // budget 필드는 이제 선택사항이며, AI가 자동으로 계산함

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: '여행지, 출발일, 귀국일은 필수 입력값입니다.' },
        { status: 400 }
      );
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 날짜 배열 생성
    const dateArray: string[] = [];
    let currentDate = start;
    while (currentDate <= end) {
      dateArray.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }

    // ===== IATA 코드 확보 로직 강화 =====
    // 출발지 IATA 코드는 ICN(인천)으로 하드코딩
    const originIataCode = 'ICN';
    
    // 도착지 IATA 코드 검색 (프롬프트 생성 전에 실행)
    let destinationIataCode: string | null = null;
    try {
      destinationIataCode = await getIataCode(destination);
      console.log(`[IATA] 출발지: ${originIataCode}, 도착지: ${destination} -> ${destinationIataCode || '검색 실패'}`);
      
      if (!destinationIataCode) {
        console.warn(`[IATA] 경고: ${destination}의 IATA 코드를 찾을 수 없습니다. 도시명으로 검색을 시도합니다.`);
      }
    } catch (error) {
      console.error('[IATA] 검색 오류:', error);
      // 검색 실패해도 계속 진행 (도시명으로 링크 생성)
    }

    // 검색 컨텍스트 생성 (최신 물가 정보 검색 지시)
    const searchContext = createSearchContext({
      destination,
      startDate,
      endDate,
      people: people ?? 1,
    });

    // 통합 프롬프트: 예산 산출 + 일정 생성
    const prompt = `
당신은 전문 여행 플래너입니다. 아래 지시사항을 단계별로 수행하여 JSON 형식으로만 응답해주세요.

**중요: 반드시 유효한 JSON만 출력하세요. 마크다운 코드블럭, 설명, 주석 없이 순수 JSON만 출력하세요.**

## 1단계: 최적 비용 산출
제공된 최신 검색 데이터와 여행 기간을 기반으로, ${destination}에서 ${totalDays}일간 ${people ?? 1}명이 여행하는데 필요한 현실적인 최소/최적 총 예상 비용을 산출하세요.

비용 항목:
- 항공편 비용 (왕복) - 반드시 포함
- 숙박 비용 (${totalDays - 1}박)
- 현지 이동 비용 (대중교통, 택시 등)
- 식비 및 음료 (${totalDays}일간 식사)
- 관광지 입장료 및 체험 프로그램
- 예비비 및 쇼핑 (기타)

**중요:** 총 예산 역산출 시, 왕복 항공권 비용을 반드시 산정하여 포함하고, 그 외 5개 현지 비용에 나머지 금액을 합리적으로 분배하세요.

총 예산을 다음 6개 항목으로 분배(Breakdown)하세요 (필수):
- flight_cost: 왕복 항공/교통비
- accommodation_cost: 숙소 비용
- local_transport_cost: 현지 이동 비용
- food_and_drink_cost: 식비 및 음료
- activities_and_tours_cost: 관광 및 체험료
- contingency_and_misc: 예비비 및 쇼핑 (기타)

**반드시:** total_amount는 이 6개 항목의 합계와 정확히 일치해야 합니다.

## 2단계: 일정 생성
1단계에서 산출한 총 예산과 분배 비율을 제약 조건으로 하여, 해당 예산 내에서 최적의 여행 일정을 생성하세요.

**지리적 효율성 고려사항:**
- 제공된 검색 정보에서 ${destination}의 주요 관광지 5곳의 위치와 대중교통 중심 지역 정보를 확인하세요
- 숙소는 검색된 주요 관광지들 사이에서 이동 거리가 가장 짧고 대중교통 이용이 편리한 곳을 선택해야 합니다
- 각 활동의 next_move_duration 필드에 예상 이동 시간(예: "지하철 15분", "도보 5분", "택시 20분")을 반드시 기재하여 이동 효율성을 증명하세요
- summary.accommodation_selection_reason 필드에 '교통 편리성'과 '주요 활동 영역 근접성'을 고려한 숙소 위치 선정 이유를 상세히 작성하세요

JSON 스키마:
{
  "estimated_budget": {
    "total_amount": 0,
    "currency": "KRW",
    "breakdown": {
      "flight_cost": 0,
      "accommodation_cost": 0,
      "local_transport_cost": 0,
      "food_and_drink_cost": 0,
      "activities_and_tours_cost": 0,
      "contingency_and_misc": 0
    }
  },
  "summary": {
    "tips": [],
    "overview": "",
    "notes": "",
    "accommodation_selection_reason": "",
    "accommodation_search_area": ""
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "title": "",
      "summary": "",
      "daily_estimated_cost": 0,
      "items": [
        {
          "time": "HH:MM",
          "place": "",
          "activity": "",
          "notes": "",
          "cost": 0,
          "next_move_duration": "",
          "image_search_link": ""
        }
      ]
    }
  ]
}

입력 정보:
- destination: ${destination}
${destinationIataCode ? `- destination_airport_code: ${destinationIataCode} (${destination}의 주요 국제공항 IATA 코드)` : `- destination_airport_code: (가장 가까운 국제공항의 IATA 코드를 추측하여 사용)`}
- startDate: ${startDate}
- endDate: ${endDate}
- people: ${people ?? 1}
- dates: ${JSON.stringify(dateArray)}
- totalDays: ${totalDays}

요구사항:
1. startDate~endDate 사이 모든 날짜를 days 배열에 포함 (총 ${totalDays}일)
2. 각 day.items는 5~8개 정도로, 이동/식사/관광/휴식 등을 포함
3. 모든 날짜는 YYYY-MM-DD 형식, 시간은 HH:MM 형식
4. 각 day.items[] 배열의 각 item에 cost 필드를 포함하여 해당 활동의 예상 비용을 명시하세요
   - cost는 숫자(원)로 표시
   - 각 날짜의 모든 item.cost의 합이 daily_estimated_cost와 일치하도록 계산
5. 각 day.daily_estimated_cost는 해당 날짜의 모든 활동(식사, 교통, 관광지 입장료, 숙박 등) 비용을 합산한 값입니다
   - 첫날/마지막날은 항공편 비용을 포함할 수 있음
   - 숙박 비용은 해당 날짜에 머무는 날 기준으로 계산 (예: 2일차는 1박 숙박비 포함)
   - 식사, 교통, 관광지, 기타 활동 비용을 모두 합산
5. estimated_budget.total_amount는 반드시 breakdown의 6개 항목(flight_cost + accommodation_cost + local_transport_cost + food_and_drink_cost + activities_and_tours_cost + contingency_and_misc)의 합계와 정확히 일치해야 합니다
   - 항공권 비용(flight_cost)을 포함한 6개 항목의 합계 = total_amount
   - 각 breakdown 항목의 값을 합산하여 total_amount와 일치하는지 반드시 검증하세요
6. **중요: 모든 날짜별 예상 비용(daily_estimated_cost)의 합계가 총 예상 예산(estimated_budget.total_amount)과 일치하도록 검토하세요.**
   - 각 날짜의 daily_estimated_cost를 합산하여 총액과 비교
   - 차이가 있으면 각 날짜의 비용을 조정하여 총 예산과 일치시킴
   - 예산 분배 비율(breakdown)과 날짜별 비용 분배가 논리적으로 일치해야 함
7. **이동 시간 정보 (필수):**
   - 각 day.items[] 배열의 각 item에 next_move_duration 필드를 포함하세요
   - 이 필드에는 해당 활동을 마친 후 다음 활동으로 이동하는 데 걸리는 예상 시간을 기록하세요
   - 형식: "지하철 15분", "도보 5분", "택시 20분", "버스 10분" 등
   - 마지막 활동의 경우 빈 문자열("")로 둘 수 있습니다
8. **이미지 검색 링크 (선택사항):**
   - 각 day.items[] 배열의 각 item에 image_search_link 필드를 포함하세요
   - **중요:** 실제 구체적인 장소나 관광지가 있는 활동에만 이미지 검색 링크를 생성하세요
   - 이미지 검색 링크를 생성해야 하는 활동: 관광지, 박물관, 공원, 특정 건축물, 유명 명소, 특정 카페나 식당 이름 등
   - 이미지 검색 링크를 생성하지 않아야 하는 활동: "숙소 체크인", "휴식", "자유 시간", "쇼핑", "식사" 등 일반적인 활동
   - 링크 생성 형식: https://www.google.com/search?q={장소명}+${destination}+여행&tbm=isch
   - 예: "에펠탑" 활동의 경우 -> https://www.google.com/search?q=에펠탑+파리+여행&tbm=isch
   - 일반적인 활동의 경우 빈 문자열("")을 반환하세요
   - URL은 URL 인코딩이 필요하므로, 장소명과 목적지를 URL 인코딩하여 포함하세요
9. **숙소 선정 이유 (필수):**
   - summary.accommodation_selection_reason 필드에 숙소 위치 선정 이유를 상세히 작성하세요
   - '교통 편리성'과 '주요 활동 영역 근접성'을 고려한 이유를 명확히 설명하세요
   - 예: "선택한 숙소는 지하철 2호선과 5호선 환승역 근처에 위치하여 주요 관광지(에펠탑, 루브르 박물관, 노트르담 등) 접근이 용이합니다."
10. **숙소 검색 지역 (필수):**
   - summary.accommodation_search_area 필드에 Booking.com에서 검색에 사용될 구체적인 지역 이름만을 작성하세요
   - accommodation_selection_reason에서 언급한 지역명을 기반으로, 검색에 최적화된 지역명만을 명시하세요
   - 형식: "마레 지구", "명동역 근처", "신주쿠역", "홍대입구역" 등
   - 도시명은 포함하지 않고 지역명만 작성하세요
9. summary.tips는 5개 정도의 여행 팁 배열
10. summary.overview는 여행지 소개 및 전반적인 정보
11. summary.notes는 주의사항 등
12. 예산은 한국 원화(KRW) 기준으로 산출
13. 최신 2024-2025년 기준 물가를 반영
14. **공항 정보**: 여행 계획에서 항공편 관련 내용이 있을 경우, destination_airport_code를 기반으로 실제 공항 이름을 언급하여 계획의 구체성을 높이세요
    - 예: "인천국제공항(ICN) 출발", "${destination}국제공항(${destinationIataCode || '공항코드'}) 도착" 등
    - 공항명을 정확히 명시하여 사용자가 여행 계획을 더 잘 이해할 수 있도록 하세요

**응답은 반드시 유효한 JSON 형식만 출력하세요. 다른 텍스트나 설명은 포함하지 마세요.**
`.trim();

    // 검색 기능 활성화하여 AI 호출
    const raw = await generateText({ 
      prompt, 
      json: false,
      searchContext,
      enableSearch: true, // 검색 기능 활성화
    });

    // JSON 파싱
    let parsed: any;
    try {
      // 마크다운 코드블럭 제거
      let cleaned = raw.trim();
      
      // ```json ... ``` 형식 제거
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

    // 간단 검증
    if (!parsed?.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 days 구조', parsed },
        { status: 500 }
      );
    }

    // estimated_budget 검증
    if (!parsed?.estimated_budget || !parsed.estimated_budget?.total_amount) {
      return NextResponse.json(
        { error: 'estimated_budget 정보가 누락되었습니다', parsed },
        { status: 500 }
      );
    }

    for (const d of parsed.days) {
      if (!d?.date || !d?.items || !Array.isArray(d.items)) {
        return NextResponse.json(
          { error: 'day에 date/items 누락', day: d },
          { status: 500 }
        );
      }
      
      // 각 item에 cost 필드 검증 (선택사항이지만 있으면 숫자 타입이어야 함)
      for (const item of d.items) {
        if (item?.cost !== undefined && typeof item.cost !== 'number') {
          console.warn(`[검증] day ${d.date}의 item에 cost가 숫자가 아닙니다:`, item);
        }
      }
    }

    // planId 생성 (간단한 타임스탬프 기반)
    const planId = `plan-${Date.now()}`;

    // ===== 외부 검색 링크 생성 (IATA 코드 및 숙소 검색 지역 포함) =====
    const accommodationSearchArea = parsed.summary?.accommodation_search_area || null;
    const external_links = createExternalLinks(
      destination, 
      startDate, 
      endDate, 
      destinationIataCode,
      accommodationSearchArea
    );
    
    // 디버깅 출력 (임시)
    console.log('=== 외부 검색 링크 생성 정보 ===');
    console.log(`출발지 IATA 코드: ${originIataCode}`);
    console.log(`도착지: ${destination}`);
    console.log(`도착지 IATA 코드: ${destinationIataCode || '(없음 - 도시명 사용)'}`);
    console.log(`출발일 (YYYY-MM-DD): ${startDate}`);
    console.log(`귀국일 (YYYY-MM-DD): ${endDate}`);
    console.log(`숙소 검색 지역: ${accommodationSearchArea || '(없음 - 전체 도시 검색)'}`);
    
    // 날짜 형식 변환 정보 출력 (내부 변환 로직 시뮬레이션)
    try {
      const convertToYYMMDD = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${year.slice(-2)}${month}${day}`;
      };
      const outboundDateYYMMDD = convertToYYMMDD(startDate);
      const returnDateYYMMDD = convertToYYMMDD(endDate);
      console.log(`출발일 (YYMMDD 형식): ${outboundDateYYMMDD}`);
      console.log(`귀국일 (YYMMDD 형식): ${returnDateYYMMDD}`);
    } catch (e) {
      console.warn('날짜 형식 변환 정보 출력 실패:', e);
    }
    
    console.log(`생성된 flight_search_url (Skyscanner): ${external_links.flight_search_url}`);
    console.log(`생성된 accommodation_search_url (Booking.com): ${external_links.accommodation_search_url}`);
    console.log('============================================');

    // 프론트가 날짜별 페이지를 바로 렌더할 수 있도록 estimated_budget, days, summary, external_links 반환
    return NextResponse.json(
      {
        planId,
        destination,
        startDate,
        endDate,
        estimated_budget: parsed.estimated_budget,
        external_links,
        summary: parsed.summary || {},
        days: parsed.days,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
