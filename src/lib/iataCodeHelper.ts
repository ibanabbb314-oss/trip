// IATA 공항 코드 검색 유틸리티
import 'server-only';
import { generateText } from './ai';

/**
 * 주요 한국 및 해외 도시 IATA 코드 매핑 (빠른 조회용)
 */
const KNOWN_AIRPORT_CODES: Record<string, string> = {
  // 한국
  '서울': 'ICN',
  '인천': 'ICN',
  '제주': 'CJU',
  '제주도': 'CJU',
  '부산': 'PUS',
  '대구': 'TAE',
  '광주': 'KWJ',
  '대전': 'CJJ',
  '여수': 'RSU',
  '양양': 'YNY',
  '울산': 'USN',
  // 해외 주요 도시
  '파리': 'CDG',
  '뉴욕': 'JFK',
  '런던': 'LHR',
  '도쿄': 'NRT',
  '베이징': 'PEK',
  '상하이': 'PVG',
  '홍콩': 'HKG',
  '싱가포르': 'SIN',
  '방콕': 'BKK',
  '대만': 'TPE',
  '타이완': 'TPE',
  '마닐라': 'MNL',
  '쿠알라룸푸르': 'KUL',
  '자카르타': 'CGK',
  '델리': 'DEL',
  '뭄바이': 'BOM',
  '두바이': 'DXB',
  '로마': 'FCO',
  '밀라노': 'MXP',
  '바르셀로나': 'BCN',
  '마드리드': 'MAD',
  '암스테르담': 'AMS',
  '베를린': 'BER',
  '프랑크푸르트': 'FRA',
  '시드니': 'SYD',
  '멜버른': 'MEL',
  '브리즈번': 'BNE',
  '오클랜드': 'AKL',
  '밴쿠버': 'YVR',
  '토론토': 'YYZ',
  '로스앤젤레스': 'LAX',
  '샌프란시스코': 'SFO',
  '시카고': 'ORD',
  '마이애미': 'MIA',
  '라스베이거스': 'LAS',
};

/**
 * 도시명 정규화
 */
function normalizeCityName(city: string): string {
  return city.trim().replace(/특별시|광역시|시|도|군|구|국|공화국/g, '').trim();
}

/**
 * 알려진 IATA 코드에서 빠르게 조회
 */
function getKnownIataCode(destination: string): string | null {
  const normalized = normalizeCityName(destination);
  
  // 정확한 매칭
  if (KNOWN_AIRPORT_CODES[normalized]) {
    return KNOWN_AIRPORT_CODES[normalized];
  }

  // 부분 매칭
  for (const [city, code] of Object.entries(KNOWN_AIRPORT_CODES)) {
    if (normalized.includes(city) || destination.includes(city)) {
      return code;
    }
  }

  return null;
}

/**
 * AI를 사용하여 IATA 공항 코드 검색 (Google Search Tool 활용)
 */
async function searchIataCodeWithAI(destination: string): Promise<string | null> {
  try {
    const prompt = `
다음 도시의 가장 큰 국제공항의 IATA 코드를 검색하여 알려주세요.

도시명: ${destination}

**검색 지시:**
1. "${destination} 주요 국제공항 IATA 코드" 또는 "${destination} airport IATA code"를 검색하세요
2. 해당 도시에서 가장 크고 주요한 국제공항의 IATA 코드를 찾으세요
3. 여러 공항이 있는 경우, 국제선 취항이 가장 많은 공항의 코드를 선택하세요

**출력 형식:**
- IATA 코드만 3자리 대문자로 출력하세요 (예: CDG, JFK, NRT, ICN)
- 다른 설명이나 텍스트는 포함하지 마세요
- 확실하지 않으면 빈 문자열을 반환하세요

IATA 코드:
`.trim();

    const response = await generateText({ 
      prompt, 
      json: false,
      enableSearch: true, // Google Search Tool 활성화
    });

    // 응답에서 IATA 코드 추출 (3자리 대문자)
    const cleanedResponse = response.trim();
    const iataMatches = cleanedResponse.match(/\b[A-Z]{3}\b/g);
    
    if (iataMatches && iataMatches.length > 0) {
      // 일반적인 IATA 코드 패턴인지 확인 (일부 특수 케이스 제외)
      const validIataCodes = iataMatches.filter(code => 
        /^[A-Z]{3}$/.test(code) && 
        !['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE'].includes(code)
      );
      
      if (validIataCodes.length > 0) {
        const code = validIataCodes[0]; // 첫 번째 유효한 코드 사용
        console.log(`[IATA AI] ${destination} -> 추출된 코드 후보: ${validIataCodes.join(', ')}, 선택: ${code}`);
        return code;
      }
    }

    console.warn(`[IATA AI] ${destination} -> IATA 코드를 추출할 수 없었습니다. 응답: ${cleanedResponse.substring(0, 100)}`);
    return null;
  } catch (error) {
    console.error(`[IATA AI] ${destination} 검색 실패:`, error);
    return null;
  }
}

/**
 * IATA 공항 코드 검색 (알려진 코드 우선, 실패 시 AI 검색)
 */
export async function getIataCode(destination: string): Promise<string | null> {
  // 1. 알려진 코드에서 빠르게 조회
  const knownCode = getKnownIataCode(destination);
  if (knownCode) {
    return knownCode;
  }

  // 2. AI 검색 (Google Search Tool 활용)
  const aiCode = await searchIataCodeWithAI(destination);
  if (aiCode) {
    return aiCode;
  }

  // 3. 실패 시 null 반환
  return null;
}

