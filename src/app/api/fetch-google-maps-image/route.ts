import { NextResponse } from 'next/server';

/**
 * 구글 지도 페이지에서 대표 이미지 URL 추출
 * POST /api/fetch-google-maps-image
 * Body: { mapsUrl: string }
 */
export async function POST(req: Request) {
  try {
    const { mapsUrl } = await req.json();

    if (!mapsUrl || typeof mapsUrl !== 'string') {
      return NextResponse.json(
        { error: 'mapsUrl is required' },
        { status: 400 }
      );
    }

    // 구글 지도 URL 유효성 검증
    let validUrl: URL;
    try {
      validUrl = new URL(mapsUrl);
      if (!validUrl.hostname.includes('google.com') || !validUrl.pathname.includes('/maps/')) {
        return NextResponse.json(
          { error: 'Invalid Google Maps URL' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // 구글 지도 페이지 HTML 가져오기
    try {
      const response = await fetch(mapsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch Google Maps page: ${response.status}` },
          { status: response.status }
        );
      }

      const html = await response.text();

      // HTML에서 이미지 URL 추출
      // 구글 지도 페이지에서 사용하는 이미지 패턴 찾기
      // 사용자 요청: decoding="async" + lh3.googleusercontent.com/gps-cs-s 패턴 우선
      const imageUrlPatterns = [
        // 패턴 1 (최우선): decoding="async" + gps-cs-s 패턴의 lh3.googleusercontent.com 이미지
        /<img[^>]*decoding=["']async["'][^>]*src=["'](https:\/\/lh3\.googleusercontent\.com\/gps-cs-s\/[^"']+)["'][^>]*>/gi,
        // 패턴 2: decoding="async" + lh3.googleusercontent.com 이미지 (w408-h566 등 크기 정보 포함)
        /<img[^>]*decoding=["']async["'][^>]*src=["'](https:\/\/lh3\.googleusercontent\.com\/[^"']*[=]w\d+-h\d+[^"']*)["'][^>]*>/gi,
        // 패턴 3: decoding="async" 가 있는 lh3.googleusercontent.com 이미지 (지도 대표 사진일 가능성이 높음)
        /<img[^>]*decoding=["']async["'][^>]*src=["'](https:\/\/lh3\.googleusercontent\.com\/[^"']+)["'][^>]*>/gi,
        // 패턴 4: 일반 lh3.googleusercontent.com 이미지
        /<img[^>]+src=["'](https:\/\/lh3\.googleusercontent\.com\/[^"']+)["'][^>]*>/gi,
        // 패턴 5: 기타 googleusercontent.com 이미지
        /<img[^>]+src=["'](https:\/\/[^/]+\.googleusercontent\.com\/[^"']+)["'][^>]*>/gi,
        // 패턴 6: 기타 google 도메인 이미지 (fallback)
        /<img[^>]+src=["'](https:\/\/[^"']*google[^"']*\/[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/gi,
      ];

      interface FoundImage {
        url: string;
        isPrimary: boolean; // decoding="async" + lh3/gps-cs-s 형식인지 여부
      }

      const foundImages: FoundImage[] = [];

      // 각 패턴으로 이미지 URL 찾기
      for (const pattern of imageUrlPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const imageUrl = match[1];
            const lower = imageUrl.toLowerCase();

            // 필터링: 유효한 이미지 URL인지 확인
            const isGoogleImage =
              lower.includes('googleusercontent.com') &&
              (lower.includes('.jpg') ||
                lower.includes('.jpeg') ||
                lower.includes('.png') ||
                lower.includes('.webp') ||
                lower.includes('=w') ||
                lower.includes('=s'));

            const isLogoOrIcon =
              lower.includes('logo') ||
              lower.includes('icon') ||
              lower.includes('avatar') ||
              lower.includes('marker') ||
              lower.includes('pin');

            if (!isGoogleImage || isLogoOrIcon) {
              continue;
            }

            // 우선순위 판단: decoding="async" + gps-cs-s 또는 크기 정보 포함
            const isPrimary =
              /decoding=["']async["']/.test(match[0]) &&
              lower.includes('lh3.googleusercontent.com') &&
              (lower.includes('gps-cs-s') || 
               /[=]w\d+-h\d+/.test(lower) || 
               lower.includes('w408-h') || 
               lower.includes('=w') || 
               lower.includes('=h'));

            // 중복 URL 방지
            if (!foundImages.some((img) => img.url === imageUrl)) {
              foundImages.push({ url: imageUrl, isPrimary });
            }
          }
        }
      }

      // 중복 제거 및 정렬 (대표 이미지 + 크기 기준)
      const scoredImages = foundImages.map((img) => {
        const getSize = (url: string): number => {
          const widthMatch = url.match(/[=]w(\d+)/);
          const heightMatch = url.match(/[=]h(\d+)/);
          if (widthMatch && heightMatch) {
            return parseInt(widthMatch[1]) * parseInt(heightMatch[1]);
          }
          return 0;
        };

        const sizeScore = getSize(img.url);
        let score = sizeScore;

        // 대표 이미지(decoding="async" + lh3/gps-cs-s 등)에 큰 가중치
        if (img.isPrimary) {
          score += 1_000_000;
        }

        return { ...img, score };
      });

      scoredImages.sort((a, b) => b.score - a.score);

      const bestImageUrl = scoredImages[0]?.url || null;
      const alternativeUrls = scoredImages.slice(1, 6).map((img) => img.url);

      if (bestImageUrl) {
        return NextResponse.json({
          success: true,
          imageUrl: bestImageUrl,
          alternatives: alternativeUrls, // 대안 이미지들도 제공
        });
      }

      // 이미지를 찾지 못한 경우
      return NextResponse.json(
        { 
          success: false,
          error: 'No suitable image found in Google Maps page',
          debug: {
            htmlLength: html.length,
            foundImageCount: foundImages.length,
          }
        },
        { status: 404 }
      );
    } catch (fetchError) {
      console.error('[구글 지도 이미지 추출] 오류:', fetchError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch or parse Google Maps page',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[구글 지도 이미지 추출] 요청 오류:', error);
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
