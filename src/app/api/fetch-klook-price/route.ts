import { NextResponse } from 'next/server';

/**
 * Klook 티켓 검색 페이지에서 가격 추출
 * POST /api/fetch-klook-price
 * Body: { url: string }
 */
export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    // Klook URL 유효성 검증
    let validUrl: URL;
    try {
      validUrl = new URL(url);
      if (!validUrl.hostname.includes('klook.com')) {
        return NextResponse.json(
          { error: 'Invalid Klook URL' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Klook 페이지 HTML 가져오기
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch Klook page: ${response.status}` },
          { status: response.status }
        );
      }

      const html = await response.text();

      // HTML에서 가격 추출
      // Klook 페이지에서 사용하는 다양한 가격 패턴 찾기
      const pricePatterns = [
        // 패턴 1: 한국 원화 (₩ 또는 원 단위)
        /₩\s*([\d,]+)/g,
        /([\d,]+)\s*원/g,
        /price["']?\s*:\s*["']?₩\s*([\d,]+)/gi,
        /price["']?\s*:\s*["']?([\d,]+)\s*원/gi,
        // 패턴 2: 숫자만 (천 단위 구분자 포함)
        /data-price["']?\s*=\s*["']?([\d,]+)/gi,
        /price["']?\s*:\s*["']?([\d,]+)/gi,
        // 패턴 3: 클래스 이름에서 가격 추출
        /class=["'][^"']*price[^"']*["'][^>]*>.*?([\d,]+)/gi,
      ];

      const foundPrices: number[] = [];

      // 각 패턴으로 가격 찾기
      for (const pattern of pricePatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const priceStr = match[1].replace(/,/g, '');
            const priceNum = parseInt(priceStr, 10);
            
            // 유효한 가격 범위 체크 (1,000원 ~ 10,000,000원)
            if (priceNum >= 1000 && priceNum <= 10000000 && !isNaN(priceNum)) {
              foundPrices.push(priceNum);
            }
          }
        }
      }

      // 중복 제거 및 정렬 (가장 낮은 가격을 선택 - 일반적으로 티켓 가격)
      const uniquePrices = [...new Set(foundPrices)].sort((a, b) => a - b);

      // 가장 낮은 가격 반환 (보통 티켓 기본 가격)
      const bestPrice = uniquePrices[0] || null;

      if (bestPrice) {
        return NextResponse.json({
          success: true,
          price: bestPrice,
          currency: 'KRW',
          alternatives: uniquePrices.slice(1, 5), // 대안 가격들도 제공
        });
      }

      // 가격을 찾지 못한 경우
      return NextResponse.json(
        { 
          success: false,
          error: 'No price found in Klook page',
          debug: {
            htmlLength: html.length,
            foundPriceCount: foundPrices.length,
          }
        },
        { status: 404 }
      );
    } catch (fetchError) {
      console.error('[Klook 가격 추출] 오류:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch or parse Klook page',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Klook 가격 추출] 요청 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Invalid request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}

