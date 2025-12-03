// 외부 검색 링크 생성 유틸리티
import 'server-only';

/**
 * 날짜 형식 변환: YYYY-MM-DD -> YYMMDD
 * @param dateStr 날짜 문자열 (YYYY-MM-DD)
 * @returns YYMMDD 형식의 날짜 문자열
 * @example "2025-12-01" -> "251201"
 */
function convertDateToYYMMDD(dateStr: string): string {
  // 날짜 형식 검증 (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateStr)) {
    throw new Error(`날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다. (입력: ${dateStr})`);
  }
  
  // YYYY-MM-DD를 파싱하여 YYMMDD로 변환
  const [year, month, day] = dateStr.split('-');
  const yearYY = year.slice(-2); // 마지막 2자리만 추출 (예: 2025 -> 25)
  
  return `${yearYY}${month}${day}`;
}

/**
 * Skyscanner 항공권 검색 URL 생성
 * 출발지와 도착지 IATA 코드를 사용하여 정확한 검색 URL 생성
 * @param destination 여행지 도시명
 * @param startDate 출발일 (YYYY-MM-DD)
 * @param endDate 귀국일 (YYYY-MM-DD)
 * @param destinationIataCode 목적지 IATA 공항 코드 (선택사항, 없으면 도시명 사용)
 */
export function createFlightSearchUrl(
  destination: string,
  startDate: string,
  endDate: string,
  destinationIataCode?: string | null
): string {
  // 출발지 IATA 코드는 ICN(인천)으로 하드코딩 (필수)
  const originIataCode = 'ICN';
  
  // 날짜 형식 변환: YYYY-MM-DD -> YYMMDD
  const outboundDateYYMMDD = convertDateToYYMMDD(startDate);
  const returnDateYYMMDD = convertDateToYYMMDD(endDate);
  
  // 도착지 코드 결정 (IATA 코드가 있으면 사용, 없으면 도시명 사용)
  const destinationCode = destinationIataCode || destination;
  
  // Skyscanner URL 생성
  // 형식: https://www.skyscanner.co.kr/transport/flights/ICN/{destinationCode}/{outboundDateYYMMDD}/{returnDateYYMMDD}
  // 또는 글로벌 도메인 사용: https://www.skyscanner.net/transport/flights/...
  // 한국 도메인(.co.kr) 우선 사용, 실패 시 .net 도메인으로 변경 가능
  return `https://www.skyscanner.co.kr/transport/flights/${originIataCode}/${destinationCode}/${outboundDateYYMMDD}/${returnDateYYMMDD}`;
}

/**
 * Booking.com 숙소 검색 URL 생성
 * @param destination 여행지 도시명
 * @param startDate 출발일 (YYYY-MM-DD)
 * @param endDate 귀국일 (YYYY-MM-DD)
 * @param searchArea AI가 분석한 최적 숙소 검색 지역 (선택사항)
 * @param people 인원수 (선택사항, 기본값 1)
 * @param rooms 방 개수 (선택사항, 기본값 1)
 */
export function createAccommodationSearchUrl(
  destination: string,
  startDate: string,
  endDate: string,
  searchArea?: string | null,
  people?: number | null,
  rooms?: number | null
): string {
  // 검색 문자열 구성: destination + searchArea (있는 경우)
  let searchString = destination.trim();
  if (searchArea && searchArea.trim()) {
    searchString = `${destination.trim()} ${searchArea.trim()}`;
  }
  
  // URL 인코딩: 전체 검색 문자열을 encodeURIComponent로 인코딩
  // 한글 지역명이나 공백이 포함된 검색어가 Booking.com에서 정상적으로 인식되도록 보장
  const encodedSearchString = encodeURIComponent(searchString);
  
  // 인원수 파라미터 (group_adults)
  const adults = people && people > 0 ? people : 1;
  // 방 개수 파라미터 (no_rooms)
  const roomCount = rooms && rooms > 0 ? rooms : 1;
  
  // checkin과 checkout 날짜 형식: YYYY-MM-DD
  return `https://www.booking.com/searchresults.ko.html?ss=${encodedSearchString}&checkin=${startDate}&checkout=${endDate}&group_adults=${adults}&no_rooms=${roomCount}`;
}

/**
 * 외부 검색 링크 객체 생성
 * @param destination 여행지 도시명
 * @param startDate 출발일 (YYYY-MM-DD)
 * @param endDate 귀국일 (YYYY-MM-DD)
 * @param destinationIataCode 목적지 IATA 공항 코드 (선택사항)
 * @param accommodationSearchArea AI가 분석한 최적 숙소 검색 지역 (선택사항)
 * @param people 인원수 (선택사항, 기본값 1)
 * @param rooms 방 개수 (선택사항, 기본값 1)
 */
export function createExternalLinks(
  destination: string,
  startDate: string,
  endDate: string,
  destinationIataCode?: string | null,
  accommodationSearchArea?: string | null,
  people?: number | null,
  rooms?: number | null
): {
  flight_search_url: string;
  accommodation_search_url: string;
} {
  return {
    flight_search_url: createFlightSearchUrl(destination, startDate, endDate, destinationIataCode),
    accommodation_search_url: createAccommodationSearchUrl(destination, startDate, endDate, accommodationSearchArea, people, rooms),
  };
}

