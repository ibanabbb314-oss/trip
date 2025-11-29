// 검색 관련 헬퍼 함수
import 'server-only';

export interface SearchContext {
  destination: string;
  startDate: string;
  endDate: string;
  people: number;
}

/**
 * 여행지 비용 정보 검색을 위한 프롬프트 컨텍스트 생성
 * 실제 Google Search API 대신 AI 모델에게 검색 지시를 포함한 컨텍스트 제공
 */
export function createSearchContext({
  destination,
  startDate,
  endDate,
  people,
}: SearchContext): string {
  const context = `
다음 여행에 대한 최신 물가 정보를 검색하여 분석해주세요:

**여행 정보:**
- 여행지: ${destination}
- 출발일: ${startDate}
- 귀국일: ${endDate}
- 인원: ${people}명

**검색해야 할 정보:**
1. **항공편 비용**: ${destination}으로 가는 항공편 평균 가격 (왕복)
2. **숙박 비용**: ${destination}의 숙박시설 평균 1박 가격 (호텔, 게스트하우스, 펜션 등)
3. **식비**: 
   - "${destination} 하루 식비 평균" 또는 "${destination} 식사 1끼 평균 가격"
   - "${destination} 식비 예산" 검색
4. **교통비**: 
   - "${destination} 대중교통 1일권 가격"
   - "${destination} 교통비 평균" 또는 "${destination} 버스 지하철 요금"
5. **관광지 입장료**: 
   - "${destination} 주요 관광지 입장료"
   - "${destination} 관광지 티켓 가격"
6. **관광지 위치 정보**:
   - "${destination} 주요 관광지 5곳의 위치"
   - "${destination} 관광지 지역 분포"
7. **대중교통 정보**:
   - "${destination} 대중교통 중심 지역"
   - "${destination} 지하철 역가 많은 지역"
   - "${destination} 관광지 접근성 좋은 지역"
8. **기타 비용**: 쇼핑, 통신비, 보험 등 기타 예상 비용

**검색 전략:**
- 물가 데이터가 적은 도시의 경우, 위의 구체적인 검색어를 사용하여 더 정확한 정보를 확보하세요
- 검색 결과가 부족할 경우, 인접 도시나 유사 규모 도시의 물가 데이터를 참고하여 추정하세요
- 예: 작은 도시의 경우 인근 대도시 물가를 기준으로 조정하여 사용
- 예: 해안 도시의 경우 다른 해안 도시의 물가 패턴을 참고

**중요:** 
- 최신 2024-2025년 기준 물가 정보를 사용하세요
- 한국 원화(KRW) 기준으로 환산해주세요
- 여행 시기(${startDate})를 고려한 계절별 가격 변동을 반영하세요
- 인원수(${people}명)를 고려한 총 비용을 계산하세요
- 가능한 한 구체적이고 실제 거래 가능한 가격을 반영하세요

이 정보를 바탕으로 현실적이고 정확한 비용 추정을 수행해주세요.
`.trim();

  return context;
}

