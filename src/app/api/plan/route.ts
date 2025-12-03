import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';
import { createSearchContext } from '@/lib/searchHelper';
import { createExternalLinks } from '@/lib/externalLinks';
import { getIataCode } from '@/lib/iataCodeHelper';
import { format, addDays, parseISO } from 'date-fns';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, startDate, endDate, people, rooms, arrivalTime, departureTime } = body || {};
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
- 현지 이동 비용 (대중교통, 택시 등) - **일차별로 별도 계산되며, breakdown의 local_transport_cost에 합산**
- 식비 및 음료 (${totalDays}일간 식사)
- 관광지 입장료 및 체험 프로그램
- 예비비 및 쇼핑 (기타)

**중요: 현지 이동비 반영 원칙**
- 현지 이동비는 각 일정 항목(item)의 cost에 포함하지 않습니다
- 현지 이동비는 일차별로 별도로 계산되며, 각 일차의 경로를 기반으로 정확하게 산정됩니다
- breakdown의 local_transport_cost는 모든 일차의 현지 이동비를 합산한 값입니다
- 현지 이동비는 0원이 될 수 없으며, 최소한 현실적인 금액을 산정해야 합니다

**중요:** 총 예산 역산출 시, 왕복 항공권 비용을 반드시 산정하여 포함하고, 그 외 5개 현지 비용에 나머지 금액을 합리적으로 분배하세요.

총 예산을 다음 6개 항목으로 분배(Breakdown)하세요 (필수):
- flight_cost: 왕복 항공/교통비
- accommodation_cost: 숙소 비용
- local_transport_cost: 현지 이동 비용
- food_and_drink_cost: 식비 및 음료
- activities_and_tours_cost: 관광 및 체험료
- contingency_and_misc: 예비비 및 쇼핑 (기타)

**반드시:** total_amount는 이 6개 항목의 합계와 정확히 일치해야 합니다.

## 2단계: 장소 중요도 순위 평가 (모든 장소에 적용)

**모든 일정에 포함되는 각 장소(관광지, 명소, 활동 장소)에 대해 장소 중요도 순위(Priority Score)를 평가하여 부여하세요.**

**중요도 평가 기준 (0~100 점수):**
1. **인기도 (Popularity) - 40% 가중치**
   - 방문객 수, 리뷰 수, 평점, SNS 언급량 등 (구글 검색 결과 활용)
   - 높은 점수 (80~100점): 세계적으로 유명한 랜드마크, SNS 인기 장소 (예: 에펠탑 95점, 타임스퀘어 90점)
   - 중간 점수 (50~79점): 인기 있는 관광지, 유명 박물관 (예: 일반 박물관 65점)
   - 낮은 점수 (20~49점): 지역적 명소, 소규모 관광지 (예: 작은 카페 30점)

2. **명성/상징성 (Fame/Iconicity) - 35% 가중치**
   - 랜드마크 여부, 역사적/문화적 상징성, 세계적 유명도
   - 높은 점수 (80~100점): 세계적으로 유명한 상징적 랜드마크 (예: 루브르 박물관 95점, 브란덴부르크 문 90점)
   - 중간 점수 (50~79점): 국가/지역적으로 유명한 장소 (예: 지역 명소 60점)
   - 낮은 점수 (20~49점): 일반적인 건물, 장소 (예: 일반 거리 25점)

3. **여행 의미/적합성 (User Fit/Significance) - 25% 가중치**
   - 여행 목적과의 연관성, 체험 가치, 반드시 방문해야 할 필수 장소 여부
   - 높은 점수 (80~100점): 해당 도시의 대표 명소, 반드시 방문해야 할 핵심 장소 (예: 파리 에펠탑 90점)
   - 중간 점수 (50~79점): 흥미로운 관광지, 추천 장소 (예: 특색 있는 장소 60점)
   - 낮은 점수 (20~49점): 선택적 방문 장소, 일반 식사/쇼핑 장소 (예: 일반 식당 35점)

**Priority Score 계산 공식:**
- Priority Score = (인기도 점수 × 0.4) + (명성 점수 × 0.35) + (의미 점수 × 0.25)
- 최종 점수는 0~100 사이의 정수로 반올림

**점수 분류:**
- 80~100점: 최고 중요도 (절대 삭제 불가, 일정의 핵심 명소)
- 60~79점: 높은 중요도 (삭제 시 신중히 고려, 우선적으로 유지)
- 40~59점: 중간 중요도 (일반 관광지, 시간/예산 여유 시 포함)
- 20~39점: 낮은 중요도 (삭제 우선 고려 대상, 선택적 포함)
- 0~19점: 최저 중요도 (식사, 휴식, 이동, 공항 관련 활동 등 일상 활동)

**주의사항:**
- 공항 관련 활동, 이동, 식사, 휴식, 숙박 체크인/아웃 등은 5~10점으로 설정
- 각 관광지/명소는 반드시 Priority Score를 부여하되, 객관적이고 합리적인 점수를 부여하세요
- 구글 검색 결과를 활용하여 실제 인기도와 명성을 참고하여 점수를 부여하세요

## 3단계: 일정 생성 (장소 중요도 기반)

**핵심 원칙: 장소 중요도 순위가 높은 장소를 우선적으로 일정에 포함하세요.**

1단계에서 산출한 총 예산과 분배 비율을 제약 조건으로 하여, 해당 예산 내에서 최적의 여행 일정을 생성하세요.

**장소 중요도 기반 일정 구성 규칙:**
- **우선순위 1**: Priority Score 80점 이상 장소를 반드시 포함 (핵심 명소, 절대 삭제 불가)
- **우선순위 2**: Priority Score 60~79점 장소를 가능한 많이 포함 (높은 중요도)
- **우선순위 3**: Priority Score 40~59점 장소는 시간과 예산 여유 시 포함 (중간 중요도)
- **낮은 우선순위**: Priority Score 20점 미만 장소는 최소한으로 포함 (일상 활동)

**일정 배치 원칙:**
- 중요도가 높은 장소는 여행 일정의 앞부분(초반)에 우선 배치
- 동선 효율성과 시간 제약을 고려하되, 중요도가 높은 장소를 우선적으로 포함

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
    "accommodation_search_area": "",
    "recommended_accommodation_area": "",
    "destination_image_query": "",
    "destination_airport_name": ""
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
          "image_search_link": "",
          "activity_image_query": "",
          "official_website_link": "",
          "purchase_search_link": "",
          "priority_score": 0
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
${arrivalTime ? `- arrivalTime: ${arrivalTime} (출국편의 여행지 도착 시각 - 첫날 일정은 이 시간 이후부터 시작)` : `- arrivalTime: (미지정 - 첫날 오전부터 일정 시작 가능)`}
${departureTime ? `- departureTime: ${departureTime} (귀국편의 여행지 출발 시각 - 마지막 날 일정은 이 시간 이전에 종료)` : `- departureTime: (미지정 - 마지막 날 오후까지 일정 가능)`}

요구사항:
1. startDate~endDate 사이 모든 날짜를 days 배열에 포함 (총 ${totalDays}일)
   - **중요:** 일정은 여행지 공항 도착부터 시작해야 합니다. 인천공항 출발이나 항공편 탑승 과정은 포함하지 마세요.
   - 첫날의 첫 번째 활동은 여행지 공항 도착 후 공항을 떠나 실제 활동을 시작하는 시점부터입니다.
   - 마지막 날의 마지막 활동은 여행지 공항으로 가는 과정까지이며, 항공편 탑승은 포함하지 않습니다.
2. 각 day.items는 5~8개 정도로, 이동/식사/관광/휴식 등을 포함
3. 모든 날짜는 YYYY-MM-DD 형식, 시간은 HH:MM 형식
4. **activity 필드의 장소 이름 형식 (Google 지도 검색 정확도 향상 - 필수):**
   - 각 day.items[]의 activity 필드는 **반드시 다음 형식**을 따라야 합니다.
     * 형식: "{장소 이름} ({도시명}, {국가명})"
     * 예시:
       - "에펠탑 (파리, 프랑스)"
       - "엠파이어 스테이트 빌딩 (뉴욕, 미국)"
       - "타임스 스퀘어 (뉴욕, 미국)"
       - "센트럴 파크 (뉴욕, 미국)"
   - 도시명과 국가는 사용자의 여행지(${destination})를 기준으로, **실제 위치에 맞는 도시/국가를 괄호 안에 한국어로 정확히 표기**하세요.
   - 동일 도시 내 이동이 대부분인 경우에도, activity에는 항상 "({도시명}, {국가명})"을 붙여 일관되게 작성하세요.
   - 공항/숙소/카페/식당/쇼핑몰 등 모든 장소에 이 형식을 적용하여 Google 지도에서 명확한 위치 검색이 가능하도록 만드세요.
   - **중요:** activity에는 **장소 이름과 위치 정보(도시, 국가)만 포함**하고, "공항", "체크인", "체크아웃", "도보", "걷기", "이동", "탐방", "투어", "산책", "휴식", "구경", "둘러보기", "복귀", "식사", "조식", "점심", "저녁" 과 같은 **행동/동사·식사·숙박 설명은 절대 포함하지 마세요.**
   - **공항/숙박/식사/카페 등 경로에서 제외될 카테고리 처리 규칙:**
     * "공항 이동", "공항 도착/출발", "숙소 체크인/체크아웃", "조식", "점심", "저녁", "디너", "브런치", "카페 방문"과 같은 **공항·숙박·식사·휴식 활동**에는 구체적인 장소 이름(예: "OO 공항", "OO 호텔", "OO 레스토랑", "OO 카페")을 activity에 포함하지 마세요.
     * 이런 활동의 activity는 "**공항 이동**", "**숙소 체크인**", "**조식**", "**점심**", "**저녁**", "**카페에서 휴식**"처럼 **일반적인 카테고리 설명만** 사용합니다.
     * 랜드마크/관광 명소/박물관/공원 등 실제 방문 장소(경로에 포함될 핵심 장소)만 "{장소 이름} ({도시명}, {국가명})" 형식을 사용하세요.
${arrivalTime ? `4. **항공편 도착 시간 반영 (필수) - 첫날 일정 처리 로직:**

   항공편 도착 시각: ${arrivalTime} (HH:MM 형식)
   
   **시간 계산 규칙:**
   - **첫 활동 가능 시각**: 항공편 도착 시각으로부터 최소 1시간 후
     (짐 픽업, 입국 수속, 공항에서 시내로 이동하는 시간 포함)
     예: 도착 20:00 → 첫 활동 21:00
   
   **일정 구성 규칙:**
   1. 첫날(${startDate})의 첫 번째 활동 시간은 **${arrivalTime} + 1시간** 이후여야 합니다.
   
   2. 공항 도착 관련 일정은 포함하지 마세요. 일정은 공항에서 최종적으로 시내로 이동한 상태부터 시작합니다.
   
   3. 첫 번째 활동 장소는 공항에서 접근하기 쉬운 곳을 선택하거나, 공항에서 숙소/첫 활동 장소까지의 이동 시간을 고려하여 현실적인 일정을 구성하세요.` : '4. 첫날 일정은 여행지 공항 도착 후 오전부터 시작 가능합니다.'}
${departureTime ? `5. **항공편 출발 시간 반영 (필수) - 마지막 날 일정 처리 로직:**

   귀국 항공편 출발 시각: ${departureTime} (HH:MM 형식)
   
   **시간 계산 규칙:**
   - **공항 도착 필요 시각**: 귀국 항공편 출발 시각에서 최소 3시간을 뺀 시각
     예: 출발 22:00 → 공항 도착 19:00
   
   - **최대 활동 가능 시각**: 공항 도착 필요 시각에서 1시간 30분을 뺀 시각
     (숙소 체크아웃 및 공항 이동 준비 시간 포함)
     예: 공항 도착 19:00 → 최대 활동 가능 17:30
   
   **일정 구성 규칙:**
   1. 최대 활동 가능 시각(${(() => {
     const [hour, min] = departureTime.split(':').map(Number);
     const departureInMinutes = hour * 60 + min;
     const airportArrivalInMinutes = departureInMinutes - 180; // 3시간 전
     const maxActivityInMinutes = airportArrivalInMinutes - 90; // 1시간 30분 전
     const maxActivityHour = Math.floor(maxActivityInMinutes / 60);
     const maxActivityMin = maxActivityInMinutes % 60;
     return `${maxActivityHour.toString().padStart(2, '0')}:${maxActivityMin.toString().padStart(2, '0')}`;
   })()}) 이전까지는 일반 관광 일정을 배치할 수 있습니다.
   
   2. 최대 활동 가능 시각을 초과하는 기존 일정이 있다면:
      - 해당 일정을 자동으로 삭제
      - 그 시간에 맞는 가벼운 활동(근처 카페, 기념품 쇼핑, 숙소 근처 휴식 등)으로 대체
      - Priority Score는 10~20점으로 설정 (낮은 중요도)
   
   3. 최대 활동 가능 시각 이후(${(() => {
     const [hour, min] = departureTime.split(':').map(Number);
     const departureInMinutes = hour * 60 + min;
     const airportArrivalInMinutes = departureInMinutes - 180; // 3시간 전
     const maxActivityInMinutes = airportArrivalInMinutes - 90; // 1시간 30분 전
     const maxActivityHour = Math.floor(maxActivityInMinutes / 60);
     const maxActivityMin = maxActivityInMinutes % 60;
     return `${maxActivityHour.toString().padStart(2, '0')}:${maxActivityMin.toString().padStart(2, '0')}`;
   })()} 이후):
      - "숙소 체크아웃 및 공항 이동 (교통수단 명시)" 일정을 포함
      - 예: "17:30 - 숙소 체크아웃 및 공항 이동 (공항버스/지하철/택시)"
      - Priority Score는 10점으로 설정
      - 이미지 검색 링크, 공식 웹사이트 링크, 티켓 검색 링크는 빈 문자열("")로 설정
   
   4. 마지막 일정의 종료 시간은 최대 활동 가능 시각(${(() => {
     const [hour, min] = departureTime.split(':').map(Number);
     const departureInMinutes = hour * 60 + min;
     const airportArrivalInMinutes = departureInMinutes - 180; // 3시간 전
     const maxActivityInMinutes = airportArrivalInMinutes - 90; // 1시간 30분 전
     const maxActivityHour = Math.floor(maxActivityInMinutes / 60);
     const maxActivityMin = maxActivityInMinutes % 60;
     return `${maxActivityHour.toString().padStart(2, '0')}:${maxActivityMin.toString().padStart(2, '0')}`;
   })()}) 이전이어야 합니다.
   
   **예시:**
   - 귀국 항공편 출발: 22:00
   - 공항 도착 필요: 19:00 (22:00 - 3시간)
   - 최대 활동 가능: 17:30 (19:00 - 1시간 30분)
   - 일정 구성:
     * 09:00 - 조식
     * 10:30 - 마지막 관광지 방문
     * 14:00 - 점심 식사
     * 15:00 - 기념품 쇼핑
     * 16:30 - 숙소 근처 카페 (마지막 활동)
     * 17:30 - 숙소 체크아웃 및 공항 이동 (공항버스)
   
   **중요:** 최대 활동 가능 시각을 절대 초과하지 마세요. 여행자가 공항에 제시간에 도착할 수 있도록 충분한 여유 시간을 확보해야 합니다.` : '5. 마지막 날 일정은 여행지 공항 도착까지 오후까지 가능합니다.'}
${arrivalTime || departureTime ? '6' : '4'}. 각 day.items[] 배열의 각 item에 cost 필드를 포함하여 해당 활동의 예상 비용을 명시하세요
   - cost는 숫자(원)로 표시
   - **중요: 각 항목의 cost에는 현지 이동비를 포함하지 마세요. 오직 해당 활동 자체의 비용만 포함하세요.**
   - 각 항목의 cost는 다음 비용만 포함해야 합니다:
     * 해당 활동 자체의 비용 (관광지 입장료, 식사 비용, 쇼핑 비용 등)
     * 현지 이동비는 별도로 일차별로 계산되므로 cost에 포함하지 않습니다
   - 예시: "에펠탑 방문" 항목의 경우
     * 에펠탑 입장료: 25,000원
     * 해당 항목의 cost = 25,000원 (이동비 제외)
${arrivalTime || departureTime ? '7' : '5'}. **숙소 복귀 일정 생성 (필수 - 마지막날 제외):**
   - **마지막날을 제외한 모든 일차**에 시간상 마지막 순서로 "숙소 복귀" 일정을 포함하세요
   - 숙소 복귀 일정 형식:
     * time: 해당 일차의 마지막 활동 이후 시간 (예: "22:00")
     * place: 빈 문자열("")
     * activity: "숙소 복귀"
     * cost: 전체 숙소비(accommodation_cost)를 일차수(마지막날 제외, 총 ${totalDays - 1}일)로 나눈 금액
       - 계산식: accommodation_cost / ${totalDays - 1} (소수점 반올림)
     * notes: 빈 문자열("")
     * next_move_duration: 빈 문자열("") (마지막 일정이므로)
     * priority_score: 10 (낮은 중요도)
     * image_search_link: 빈 문자열("")
     * activity_image_query: 빈 문자열("")
     * official_website_link: 빈 문자열("")
     * purchase_search_link: 빈 문자열("")
   - 예시: 3일 여행, 숙소비 300,000원인 경우
     * 1일차 마지막: "22:00 - 숙소 복귀" (cost: 150,000원)
     * 2일차 마지막: "22:00 - 숙소 복귀" (cost: 150,000원)
     * 3일차(마지막날): 숙소 복귀 일정 없음
   - **중요:** 숙소 복귀 일정은 해당 일차의 시간상 마지막 순서로 배치해야 합니다
${arrivalTime || departureTime ? '8' : '6'}. 각 day.daily_estimated_cost는 해당 날짜의 모든 item.cost의 합계와 정확히 일치해야 합니다
   - **필수 검증:** 일정 생성 후 각 날짜별로 모든 item.cost를 합산하여 daily_estimated_cost와 일치하는지 반드시 확인하세요
   - 첫날/마지막날은 항공편 비용도 항목에 포함될 수 있음
   - 숙박 비용은 숙소 복귀 일정의 cost에 포함됨 (마지막날 제외한 모든 일차의 마지막 항목)
   - **주의:** daily_estimated_cost에는 현지 이동비가 포함되지 않습니다. 현지 이동비는 별도로 일차별로 계산됩니다.
${arrivalTime || departureTime ? '8' : '6'}. estimated_budget.total_amount는 반드시 breakdown의 6개 항목(flight_cost + accommodation_cost + local_transport_cost + food_and_drink_cost + activities_and_tours_cost + contingency_and_misc)의 합계와 정확히 일치해야 합니다
   - 항공권 비용(flight_cost)을 포함한 6개 항목의 합계 = total_amount
   - 각 breakdown 항목의 값을 합산하여 total_amount와 일치하는지 반드시 검증하세요
    - **중요:** 항공권 비용(flight_cost), 숙소 비용(accommodation_cost), 현지 이동 비용(local_transport_cost)은 0원이 될 수 없습니다. 최소한 현실적인 양의 값(> 0)을 유지하세요.
${arrivalTime || departureTime ? '9' : '7'}. **중요: 모든 날짜별 예상 비용(daily_estimated_cost)의 합계가 총 예상 예산(estimated_budget.total_amount)과 일치하도록 검토하세요.**
   - 각 날짜의 daily_estimated_cost를 합산하여 총액과 비교
   - 차이가 있으면 각 날짜의 비용을 조정하여 총 예산과 일치시킴
   - 예산 분배 비율(breakdown)과 날짜별 비용 분배가 논리적으로 일치해야 함
    - 재조정/수정이 필요하더라도, 항공권/숙소/공항 이동과 같은 핵심 비용 항목을 0으로 만들지 마세요.
${arrivalTime || departureTime ? '10' : '8'}. **장소 중요도 순위 (Priority Score) - 필수:**
   - 각 day.items[] 배열의 각 item에 priority_score 필드를 포함하세요 (0~100 정수)
   - 위 2단계에서 설명한 기준에 따라 각 장소의 중요도를 평가하여 점수를 부여하세요
   - 모든 관광지/명소는 반드시 Priority Score를 부여하되, 객관적이고 합리적인 점수를 부여하세요
   - 공항 관련, 이동, 식사, 휴식 등 일상 활동은 5~10점으로 설정
   - 핵심 명소(랜드마크 등)는 80점 이상, 일반 관광지는 40~79점, 선택적 장소는 20~39점으로 설정

${arrivalTime || departureTime ? '11' : '9'}. **이동 시간 정보 (필수):**
   - 각 day.items[] 배열의 각 item에 next_move_duration 필드를 포함하세요
   - 이 필드에는 해당 활동을 마친 후 다음 활동으로 이동하는 데 걸리는 예상 시간을 기록하세요
   - 형식: "지하철 15분", "도보 5분", "택시 20분", "버스 10분" 등
   - 마지막 활동의 경우 빈 문자열("")로 둘 수 있습니다
${arrivalTime || departureTime ? '12' : '10'}. **이미지 검색 링크 및 이미지 쿼리 (선택사항):**
   - 각 day.items[] 배열의 각 item에 image_search_link와 activity_image_query 필드를 포함하세요
   - **중요:** 실제 구체적인 장소나 관광지가 있는 활동에만 이미지 검색 링크를 생성하세요
   - 이미지 검색 링크를 생성해야 하는 활동: 관광지, 박물관, 공원, 특정 건축물, 유명 명소, 특정 카페나 식당 이름 등
   - 이미지 검색 링크를 생성하지 않아야 하는 활동: "숙소 체크인", "휴식", "자유 시간", "쇼핑", "식사", "공항 도착", "공항 출발", "공항으로 이동", "공항 도착", "체크인", "체크아웃", "출발", "도착", "공항", "airport", "도착지 공항", "출발지 공항" 등 일반적인 활동 및 공항 관련 활동
   - 링크 생성 형식: https://www.google.com/search?q={장소명}+${destination}+여행&tbm=isch
   - 예: "에펠탑" 활동의 경우 -> https://www.google.com/search?q=에펠탑+파리+여행&tbm=isch
   - 일반적인 활동의 경우 빈 문자열("")을 반환하세요
   - URL은 URL 인코딩이 필요하므로, 장소명과 목적지를 URL 인코딩하여 포함하세요
  - activity_image_query 필드: image_search_link가 빈 문자열이 아닌 경우, 해당 명소의 영어 이름을 포함한 검색어를 반환하세요
  - **핵심 (절대 준수):** **해당 장소의 건물 외관, 전경, 거리 풍경, 공원 풍경 또는 스카이라인을 보여주는 사진을 찾기 위한 구체적인 영어 검색어**를 반환하세요
  - **검색어 포함 필수 요소 (반드시 준수 - 최우선순위 키워드):**
    * 장소 이름과 목적지(도시/국가) 이름을 포함하고,
    * **반드시 다음 키워드 중 1개 이상을 포함**하세요 (우선순위 순서):
      1. **'building exterior'** (건물 외관) - 건물/랜드마크에 최우선 적용
      2. **'exterior view'** (외관 전경) - 건물/명소 전경
      3. **'street view'** (거리 전경) - 거리/구역/광장에 최우선 적용
      4. **'panorama'** (파노라마 전경) - 넓은 전경 사진
      5. **'cityscape'** (도시 전경) - 도시 풍경
      6. **'skyline'** (스카이라인) - 도시 스카이라인
      7. **'park view'** (공원 전경) - 공원/정원에 최우선 적용
      8. **'landscape'** (풍경) - 자연/공원 풍경
      9. **'facade'** (정면 외관) - 건물 정면
      10. **'view'** (전경) - 일반 전경
      11. **'exterior'** (외관) - 외관
      12. **'location'** (장소) - 장소
      13. **'place'** (장소) - 장소
  - **검색어 예시:**
    * "Eiffel Tower Paris building exterior panorama"
    * "Louvre Museum Paris building exterior street view"
    * "Berlin Reichstag Building cityscape panorama"
    * "Times Square New York street view panorama"
    * "Central Park New York skyline panorama"
  - 명소의 특성에 따라 적절한 키워드를 선택하여 대표성 높은 전경/건물 사진을 찾기 위한 구체적인 영어 검색어를 반환하세요
   - **명소 타입별 검색어 전략 (매우 구체적으로 작성):**
     * **구역/광장/시장/거리 (예: 명동, 신주쿠, 타임스퀘어, 부티크거리):** 
       - 형식: "{place 이름} {destination} panoramic view" 또는 "{place 이름} {destination} street scene" 또는 "{place 이름} {destination} overview photograph" 또는 "{place 이름} {destination} famous area photograph"
       - 예시: "Myeongdong Seoul panoramic view", "Times Square New York famous landmark overview", "Shibuya Tokyo street scene photograph", "Harajuku Tokyo famous district view"
       - 추가 키워드: "famous", "popular", "tourist", "vibrant", "bustling" 등
     * **건물/랜드마크/기념물 (예: 에펠탑, 루브르 박물관, 브란덴부르크 문, 사원):** 
       - 형식: "{place 이름} {destination} exterior photograph" 또는 "{place 이름} {destination} full view" 또는 "{place 이름} {destination} main entrance" 또는 "{place 이름} {destination} famous landmark"
       - 예시: "Eiffel Tower Paris full view photograph", "Louvre Museum Paris exterior famous", "Brandenburg Gate Berlin landmark photograph", "Senso-ji Tokyo temple exterior view"
       - 추가 키워드: "iconic", "famous", "landmark", "monument", "architecture"
     * **박물관/미술관:**
       - 형식: "{place 이름} {destination} museum exterior" 또는 "{place 이름} {destination} art gallery building" 또는 "{place 이름} {destination} museum entrance photograph"
       - 예시: "British Museum London exterior", "Metropolitan Museum New York building view", "Uffizi Gallery Florence entrance photograph"
    * **공원/정원:**
      - 형식: "{place 이름} {destination} park view" 또는 "{place 이름} {destination} garden scenic view" 또는 "{place 이름} {destination} park landscape panorama"
      - 예시: "Central Park New York landscape view", "Hyde Park London scenic view", "Gyeongbokgung Seoul palace garden view"
    * **시장/음식거리:**
      - 형식: "{place 이름} {destination} market street view" 또는 "{place 이름} {destination} market panorama"
      - 예시: "Tsukiji Market Tokyo market street view", "Gwangjang Market Seoul market street view", "Borough Market London market panorama"
    * **카페/레스토랑 (유명한 곳):**
      - 형식: "{place 이름} {destination} restaurant exterior street view" 또는 "{place 이름} {destination} building exterior"
      - 예시: "Blue Bottle Coffee Tokyo building exterior", "Angelina Paris cafe exterior street view", "Joe's Pizza New York restaurant exterior"
  - **공통 필수 요소:** 
    * 모든 검색어에 **'building exterior'**, **'street view'**, **'skyline'**, **'panorama'**, **'cityscape'**, **'view'** 와 같은 전경/건물 단위 키워드 중에서 1개 이상을 반드시 포함하세요.
    * 장소의 유명도나 특성을 나타내는 키워드(famous, iconic, popular, scenic, vibrant 등)를 적절히 활용하세요.
    * 도시/여행지 이름({destination})을 포함하여 검색 정확도를 높이세요.
    * **절대 포함하지 말아야 할 키워드:** "person", "people", "portrait", "selfie", "close up", "food", "dish", "meal", "drink", "coffee", "car", "vehicle" 등 인물/음식/차량 중심 사진을 유도하는 단어는 activity_image_query에 포함하지 마세요.
   - image_search_link가 빈 문자열이면 activity_image_query도 빈 문자열("")을 반환하세요
${arrivalTime || departureTime ? '12' : '10'}. **공식 웹사이트 및 티켓 검색 링크 (예약 필요 여부에 따라 세분화):**
   - 각 day.items[] 배열의 각 item에 다음 두 필드를 포함하세요:
     * **official_website_link**: 해당 활동(건물, 명소)의 공식 웹사이트 URL을 저장합니다 (정보 획득 목적)
     * **purchase_search_link**: Klook에서 해당 활동을 검색한 결과 페이지 URL (티켓 구매 탐색 목적)
   - **핵심 조건 (절대 준수):**
     * **모든 이벤트성 활동 (식사, 숙박, 휴식 제외):** image_search_link를 반환합니다 (위 8번 참조)
     * **이벤트성 활동 중, 예약/티켓 구매가 필요하다고 판단한 활동만:** official_website_link와 purchase_search_link 두 필드 모두를 반환합니다
     * **그 외의 모든 활동 (식사, 이동, 휴식) 및 예약이 불필요한 이벤트성 활동:** official_website_link와 purchase_search_link 필드는 반드시 빈 문자열("")을 반환하세요
   - **예약/티켓 구매가 필요한 활동 예시:** 박물관, 테마파크, 공연장, 특별 체험 프로그램, 전시회, 뮤지컬, 콘서트, 유료 투어 프로그램, 스카이덱 입장 등
   - **예약이 불필요한 이벤트성 활동 예시:** 무료 공원, 무료 거리 산책, 무료 광장 방문, 일반적인 카페 방문 등
   - **비이벤트성 활동 (식사, 숙박, 휴식, 이동, 공항 이동):** official_website_link와 purchase_search_link 필드에 반드시 빈 문자열("")을 반환하세요
   - **공항 관련 활동 (공항 도착, 공항 출발, 공항으로 이동 등)에는 절대 이미지 검색 링크, 공식 웹사이트 링크, 티켓 검색 링크를 생성하지 마세요. 이들은 여행의 핵심 포인트가 아닙니다.**
   - 예약이 필요한 이벤트성 활동의 경우:
     * Google Search Tool을 사용하여 해당 활동의 공식 웹사이트 URL을 찾아 official_website_link 필드에 포함
     * purchase_search_link는 Klook 검색 URL을 직접 생성: https://www.klook.com/ko/search?query={활동 이름}
     * 활동 이름은 URL 인코딩하여 삽입하세요 (예: "에펠탑" -> "https://www.klook.com/ko/search?query=%EC%97%90%ED%8E%A0%ED%83%91")
   - 두 링크 모두 찾지 못할 경우: 빈 문자열("")을 반환하세요 (null이 아닌 빈 문자열)
${arrivalTime || departureTime ? '13' : '11'}. **여행지 대표 이미지 쿼리 (필수):**
   - summary.destination_image_query 필드에 여행지(도시 또는 국가)의 도시 전경(skyline, cityscape)을 나타내는 영어 검색어를 반환하세요
   - **핵심 (절대 준수):** 해당 여행지의 도시 전경을 넓은 화각으로 보여주는 이미지를 찾기 위한 구체적인 영어 검색어를 반환하세요
   - **우선순위:** 도시 전경(skyline, cityscape, city view)을 최우선으로 하고, 랜드마크는 보조적으로 사용하세요
   - 형식: "{도시/국가 이름} skyline" 또는 "{도시/국가 이름} cityscape" 또는 "{도시/국가 이름} city view"
   - **영어 검색어 예시 (도시 전경 우선):**
     * "New York City skyline"
     * "Paris cityscape"
     * "Berlin city view"
     * "Tokyo skyline ultrawide"
     * "London cityscape panoramic"
     * "Seoul skyline"
   - 도시 전경 이미지를 찾을 수 없는 경우에만, 해당 도시/국가의 가장 유명한 랜드마크를 포함한 검색어를 사용하세요
   - **이미지 비율 및 품질 우선순위 (최대한 강력하게 강조):** 21:9 비율에 가까운 도시 전경 사진을 우선적으로 찾기 위해 반드시 "skyline", "cityscape", "city view", "ultrawide", "panoramic" 등의 키워드를 포함하세요
   - 이 필드는 클라이언트에서 Wikimedia Commons 이미지를 검색하는 데 사용되며, 21:9 비율에 적합한 도시 전경 이미지를 최우선으로 찾아야 합니다
${arrivalTime || departureTime ? '14' : '12'}. **숙소 선정 이유 (필수):**
   - summary.accommodation_selection_reason 필드에 숙소 위치 선정 이유를 상세히 작성하세요
   - '교통 편리성'과 '주요 활동 영역 근접성'을 고려한 이유를 명확히 설명하세요
   - 예: "선택한 숙소는 지하철 2호선과 5호선 환승역 근처에 위치하여 주요 관광지(에펠탑, 루브르 박물관, 노트르담 등) 접근이 용이합니다."
${arrivalTime || departureTime ? '15' : '13'}. **숙소 검색 지역 (필수):**
   - summary.accommodation_search_area 필드에 Booking.com에서 검색에 사용될 구체적인 지역 이름만을 작성하세요
   - accommodation_selection_reason에서 언급한 지역명을 기반으로, 검색에 최적화된 지역명만을 명시하세요
   - 형식: "마레 지구", "명동역 근처", "신주쿠역", "홍대입구역" 등
   - 도시명은 포함하지 않고 지역명만 작성하세요
   - summary.recommended_accommodation_area 필드에는 **여행자가 실제로 숙소를 잡기 좋은 대표 숙소 추천 지역**을 도시와 국가 정보까지 포함하여 작성하세요.
     * 예시: "미드타운 맨해튼, 뉴욕, 미국", "마레 지구, 파리, 프랑스", "신주쿠, 도쿄, 일본"
     * 항상 "{지역명}, {도시명}, {국가명}" 형식을 사용하세요.
     * Google 검색/지도 정보를 활용해, 교통 편리성과 관광 중심지 접근성이 모두 좋은 지역을 1곳으로 선정하세요.
${arrivalTime || departureTime ? '16' : '14'}. summary.tips는 5개 정도의 여행 팁 배열
${arrivalTime || departureTime ? '17' : '15'}. summary.overview는 여행지 소개 및 전반적인 정보
${arrivalTime || departureTime ? '18' : '16'}. summary.notes는 주의사항 등
${arrivalTime || departureTime ? '19' : '17'}. 예산은 한국 원화(KRW) 기준으로 산출
${arrivalTime || departureTime ? '20' : '18'}. 최신 2024-2025년 기준 물가를 반영
${arrivalTime || departureTime ? '21' : '19'}. **공항 정보**: 여행 계획에서 항공편 관련 내용이 있을 경우, destination_airport_code를 기반으로 실제 공항 이름을 언급하여 계획의 구체성을 높이세요
    - 예: "인천국제공항(ICN) 출발", "${destination}국제공항(${destinationIataCode || '공항코드'}) 도착" 등
    - 공항명을 정확히 명시하여 사용자가 여행 계획을 더 잘 이해할 수 있도록 하세요
    - summary.destination_airport_name 필드에는 **여행지 도착 공항의 공식 명칭과 위치(도시, 국가)를 포함한 전체 이름**을 작성하세요.
      * 예시: "존 F. 케네디 국제공항, 뉴욕, 미국", "샤를 드 골 공항, 파리, 프랑스", "하네다 공항, 도쿄, 일본"
      * 항상 "{공항명}, {도시명}, {국가명}" 형식을 사용하세요.

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
      accommodationSearchArea,
      people ?? 1,
      rooms ?? 1
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
        arrivalTime: arrivalTime || null,
        departureTime: departureTime || null,
        people: people ?? 1,
        rooms: rooms ?? 1,
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
