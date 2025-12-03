'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, X, Loader2, Plane, Hotel, ExternalLink, RefreshCw, MapPin, Navigation, Image, Download, Save, Globe, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DayItem {
  time: string;
  place: string;
  activity: string;
  notes?: string;
  cost?: number;
  next_move_duration?: string;
  image_search_link?: string;
  activity_image_query?: string;
  official_website_link?: string;
  purchase_search_link?: string;
  priority_score?: number; // 장소 중요도 순위 (0~100)
}

interface DayPlan {
  date: string;
  title: string;
  summary: string;
  daily_estimated_cost?: number;
  daily_transport_cost?: number; // 일별 현지 이동비
  items: DayItem[];
}

interface EstimatedBudget {
  total_amount: number;
  currency: string;
  breakdown: {
    flight_cost?: number;
    accommodation_cost?: number;
    local_transport_cost?: number;
    food_and_drink_cost?: number;
    activities_and_tours_cost?: number;
    contingency_and_misc?: number;
    // 하위 호환성을 위한 기존 필드 (선택사항)
    food?: number;
    accommodation?: number;
    transportation?: number;
    activities?: number;
    misc?: number;
  };
}

interface Summary {
  budget?: {
    accommodation?: number;
    food?: number;
    transportation?: number;
    attractions?: number;
    other?: number;
    total?: number;
  };
  tips?: string[];
  overview?: string;
  notes?: string;
  accommodation_selection_reason?: string;
  recommended_accommodation_area?: string;
  destination_image_query?: string;
  destination_airport_name?: string;
}

interface ExternalLinks {
  flight_search_url: string;
  accommodation_search_url: string;
}

interface PlanData {
  planId: string;
  destination: string;
  startDate: string;
  endDate: string;
  arrivalTime?: string | null;
  departureTime?: string | null;
  people?: number;
  rooms?: number;
  estimated_budget?: EstimatedBudget;
  external_links?: ExternalLinks;
  summary: Summary;
  days: DayPlan[];
}

function PlanResultContent() {
  const searchParams = useSearchParams();
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const hasLoadedRef = useRef(false);

  // 단순 식사(특별한 지정된 장소가 아닌 일반 식사) 판단 함수
  const isSimpleMealActivity = (item: DayItem): boolean => {
    const placeLower = (item.place || '').toLowerCase();
    const activityLower = (item.activity || '').toLowerCase();

    // 식사 관련 키워드
    const mealKeywords = [
      '식사', '점심', '저녁', '아침', '브런치', '조식', '중식', '석식',
      'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'dining', 'snack',
    ];

    // 일반적인 식당/카페 표현 (특정 명소라기보다는 유형 표현에 가까운 것들)
    const genericPlaceKeywords = [
      '레스토랑', '식당', '카페', '푸드코트', '분식점',
      'restaurant', 'cafe', 'diner', 'bistro', 'food court',
      'local restaurant', 'local food', 'street food', '맛집',
    ];

    const hasMealWord =
      mealKeywords.some((k) => activityLower.includes(k)) ||
      mealKeywords.some((k) => placeLower.includes(k));

    if (!hasMealWord) return false;

    // 장소명이 없거나, 일반적인 식당/카페 표현이면 단순 식사로 간주
    if (!placeLower) return true;

    const isGenericPlace = genericPlaceKeywords.some((k) =>
      placeLower.includes(k.toLowerCase())
    );

    return isGenericPlace;
  };

  // 각 항목의 cost가 예산 분배의 어느 항목에 속하는지 판단하는 함수
  const getBudgetCategoryForItem = (item: DayItem): string | null => {
    const placeLower = (item.place || '').toLowerCase();
    const activityLower = (item.activity || '').toLowerCase();
    const notesLower = (item.notes || '').toLowerCase();
    
    // 식비 및 음료 (food_and_drink_cost) - 우선 확인
    // 조식, 점심, 저녁 등 먹는 것과 관련된 키워드가 있으면 숙소 키워드보다 우선하여 식비 및 음료로 분류
    // 조식은 반드시 식비 및 음료로 분류
    const breakfastKeywords = ['조식', 'breakfast', '아침'];
    if (breakfastKeywords.some(keyword => 
      placeLower.includes(keyword) || 
      activityLower.includes(keyword) || 
      notesLower.includes(keyword)
    )) {
      return '식비 및 음료';
    }
    
    // 점심, 저녁, 카페 등 기타 식사 관련 키워드
    const mealKeywords = [
      '점심', '저녁', '식사', '브런치', '중식', '석식',
      '식당', '레스토랑', '카페', '음식', '맛집', '디너', '야식', '간식', '디저트',
      'dining', 'meal', 'restaurant', 'cafe', 'food', 'lunch', 'dinner', 'brunch',
      'snack', 'dessert', 'coffee', 'tea', 'beverage', 'drink'
    ];
    if (mealKeywords.some(keyword => 
      placeLower.includes(keyword) || 
      activityLower.includes(keyword) || 
      notesLower.includes(keyword)
    )) {
      return '식비 및 음료';
    }
    
    // 숙소비 (accommodation_cost) - 식사 관련 키워드가 없을 때만 확인
    const accommodationKeywords = [
      '숙소', '호텔', '게스트하우스', '호스텔', '리조트', '체크인', '체크아웃',
      'accommodation', 'hotel', 'hostel', 'guesthouse', 'resort', 'check-in', 'check-out',
      'lodging', 'stay'
    ];
    if (accommodationKeywords.some(keyword => 
      placeLower.includes(keyword) || 
      activityLower.includes(keyword) || 
      notesLower.includes(keyword)
    )) {
      return '숙소비';
    }
    
    // 현지 이동비는 각 항목의 cost에 포함되지 않고, 일별 daily_transport_cost로 별도 계산됨
    // 따라서 여기서는 '현지 이동비' 카테고리를 반환하지 않음
    
    // 관광 및 체험료 (activities_and_tours_cost) - 기본값
    return '관광 및 체험료';
  };

  // 각 일차의 시간상 마지막 숙소 일정 항목을 찾는 함수
  const findLastAccommodationItemIndex = (items: DayItem[]): number | null => {
    // 시간을 파싱하여 시간상으로 가장 늦은 숙소 일정 항목 찾기
    let lastAccommodationIndex: number | null = null;
    let lastTime: number = -1; // 시간(분 단위)

    items.forEach((item, index) => {
      const category = getBudgetCategoryForItem(item);
      if (category === '숙소비') {
        // 시간 파싱 (HH:MM 형식)
        const timeMatch = item.time.match(/(\d{1,2}):(\d{1,2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const timeInMinutes = hours * 60 + minutes;
          
          // 시간상으로 가장 늦은 숙소 일정 찾기
          if (timeInMinutes > lastTime) {
            lastTime = timeInMinutes;
            lastAccommodationIndex = index;
          }
        } else {
          // 시간 파싱 실패 시 배열의 마지막 숙소 일정 사용
          if (lastAccommodationIndex === null) {
            lastAccommodationIndex = index;
          }
        }
      }
    });

    return lastAccommodationIndex;
  };

  // 숙소비를 각 일차(마지막날 제외)의 마지막 숙소 일정 항목에 동일하게 분배하는 함수
  const distributeAccommodationCost = (data: PlanData): PlanData => {
    if (!data.days || !data.estimated_budget) return data;

    const accommodationCost = data.estimated_budget.breakdown?.accommodation_cost || 0;
    if (accommodationCost <= 0) return data;

    // 마지막날을 제외한 모든 일차 찾기
    const totalDays = data.days.length;
    const daysToDistribute = data.days.slice(0, totalDays - 1);

    // 각 일차의 마지막 숙소 일정 항목 찾기
    const accommodationItems: Array<{ dayIndex: number; itemIndex: number }> = [];
    daysToDistribute.forEach((day, dayIndex) => {
      const lastAccommodationIndex = findLastAccommodationItemIndex(day.items);
      if (lastAccommodationIndex !== null) {
        accommodationItems.push({ dayIndex, itemIndex: lastAccommodationIndex });
      }
    });

    // 숙소비가 분배될 항목이 없으면 그대로 반환
    if (accommodationItems.length === 0) return data;

    // 숙소비를 동일하게 분배
    const costPerItem = Math.round(accommodationCost / accommodationItems.length);

    // 각 항목에 숙소비 분배
    const updatedDays = data.days.map((day, dayIndex) => {
      const accommodationItem = accommodationItems.find(item => item.dayIndex === dayIndex);
      if (accommodationItem) {
        return {
          ...day,
          items: day.items.map((item, itemIndex) => {
            if (itemIndex === accommodationItem.itemIndex) {
              return {
                ...item,
                cost: costPerItem,
              };
            }
            return item;
          }),
        };
      }
      return day;
    });

    return {
      ...data,
      days: updatedDays,
    };
  };

  // 각 항목의 cost를 예산 분류별로 합산하고 예산 분배 항목을 업데이트하는 함수
  const updateBudgetFromItemCosts = (data: PlanData): PlanData => {
    if (!data.days || !data.estimated_budget) return data;

    // 먼저 숙소비를 분배
    let updatedData = distributeAccommodationCost(data);

    // 각 항목의 cost를 예산 분류별로 합산
    // 조식, 점심, 저녁, 카페 등 먹는 것에 대한 비용은 "식비 및 음료"로 분류
    // 각 항목 cost의 합이 예산 분배에서 해당 카테고리 예산이 되도록 합산
    let foodAndDrinkCost = 0;
    let activitiesAndToursCost = 0;

    updatedData.days.forEach((day) => {
      day.items.forEach((item) => {
        const cost = item.cost || 0;
        if (cost > 0) {
          const category = getBudgetCategoryForItem(item);
          // 숙소비는 제외 (기존 accommodation_cost 유지)
          if (category === '식비 및 음료') {
            // 조식, 점심, 저녁, 카페 등 먹는 것에 대한 비용 합산
            foodAndDrinkCost += cost;
          } else if (category === '관광 및 체험료') {
            // 관광 및 체험에 대한 비용 합산
            activitiesAndToursCost += cost;
          }
          // 현지 이동비는 각 항목의 cost에 포함되지 않고, 일별 daily_transport_cost로 별도 계산됨
          // 숙소비('숙소비')는 합산하지 않음 (기존 accommodation_cost 유지)
        }
      });
    });

    // 일별 현지 이동비 합산
    const localTransportCost = updatedData.days.reduce(
      (sum, day) => sum + (day.daily_transport_cost || 0),
      0
    );

    // 기존 예산 분배 항목 가져오기 (항공/숙소는 유지)
    const existingBreakdown = updatedData.estimated_budget.breakdown || {};
    const flightCost = existingBreakdown.flight_cost || 0;
    const accommodationCost = existingBreakdown.accommodation_cost || 0;
    const contingencyAndMisc = existingBreakdown.contingency_and_misc || 0;

    // 예산 분배 항목 업데이트: 각 항목 cost 합산값이 예산 분배 항목의 총 예산이 되도록 설정
    // - food_and_drink_cost = 조식, 점심, 저녁, 카페 등 먹는 것에 대한 비용 합계
    // - local_transport_cost = 일별 현지 이동비 합계
    // - activities_and_tours_cost = 관광 및 체험에 대한 비용 합계
    const updatedBreakdown = {
      ...existingBreakdown,
      flight_cost: flightCost,
      accommodation_cost: accommodationCost,
      local_transport_cost: localTransportCost, // 일별 현지 이동비 합계
      food_and_drink_cost: foodAndDrinkCost, // 조식, 점심, 저녁, 카페 등 먹는 것에 대한 비용 합계
      activities_and_tours_cost: activitiesAndToursCost, // 관광 및 체험에 대한 비용 합계
      contingency_and_misc: contingencyAndMisc,
    };

    // 총 예산 계산 (예산 분배 항목들의 합)
    const totalAmount = 
      flightCost +
      accommodationCost +
      localTransportCost +
      foodAndDrinkCost +
      activitiesAndToursCost +
      contingencyAndMisc;

    return {
      ...updatedData,
      estimated_budget: {
        ...updatedData.estimated_budget,
        total_amount: totalAmount,
        breakdown: updatedBreakdown,
      },
    };
  };
  
  // 예산 재조정 상태
  const [realFlightCost, setRealFlightCost] = useState<string>('');
  const [realAccommodationCost, setRealAccommodationCost] = useState<string>('');
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [rebalanceSuccess, setRebalanceSuccess] = useState(false);
  // 항공편 시간 입력 상태
  const [inputArrivalTime, setInputArrivalTime] = useState<string>('');
  const [inputDepartureTime, setInputDepartureTime] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [destinationImageUrls, setDestinationImageUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  // 일정 항목별 이미지 상태 관리 (key: `${dayIndex}-${itemIndex}`, value: { url: string | null, loading: boolean })
  const [itemImages, setItemImages] = useState<Record<string, { url: string | null; loading: boolean }>>({});
  // 이미지 확대 모달 상태
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [enlargedImageAlt, setEnlargedImageAlt] = useState<string>('');

  // Google 지도 길찾기에서 제외할 키워드 (비핵심 활동 및 이동/체류/공항 관련 행위)
  const EXCLUDE_KEYWORDS = [
    '숙소',
    '카페',
    '식당',
    '호텔',
    '조식',
    '점심',
    '저녁',
    '복귀',
    '휴식',
    '체크인',
    '체크아웃',
    '이동',
    '공항',
  ];

  // 요약 정보에서 추천 숙소 지역(도시/국가 포함) 가져오기
  const accommodationArea = planData?.summary?.recommended_accommodation_area?.trim() || '';
  // 요약 정보에서 도착 공항 공식 이름(도시/국가 포함) 가져오기
  const airportName = planData?.summary?.destination_airport_name?.trim() || '';

  // activity 문자열에서 Google 지도 경로에 사용할 "순수 장소명 (도시, 국가)"만 추출
  // 예: "자유의 여신상 (뉴욕, 미국) (페리 탑승 및 관람)" -> "자유의 여신상 (뉴욕, 미국)"
  const extractPlaceForRoute = (activity: string): string => {
    const trimmed = activity.trim();
    if (!trimmed) return '';

    // activity 내 괄호 쌍 개수 확인
    const matches = trimmed.match(/\([^()]*\)/g);
    if (!matches || matches.length <= 1) {
      // 괄호가 없거나 1개만 있으면 전체를 그대로 사용
      return trimmed;
    }

    // 마지막 괄호 쌍은 세부 설명을 위한 것으로 간주하고 제거
    return trimmed.replace(/\s*\([^()]*\)\s*$/, '').trim();
  };

  // 일차별 Google 지도 길찾기 URL 생성
  // - 경로용 장소 문자열은 "볼드체 장소 이름(=place) + 여행지(destination)"만 사용
  // - 회색 설명 텍스트(=activity)의 세부 설명은 사용하지 않음
  const getDayDirectionsUrl = (day: DayPlan, dayIndex: number, totalDays: number): string | null => {
    if (!day.items || day.items.length === 0) return null;

    // 일정의 place(볼드체 장소 이름)를 기반으로 경로용 문자열을 만들고,
    // 중요하지 않은 장소(숙소/카페/식당/공항/이동 등)는 제외
    // 조식, 점심, 저녁 항목은 경로에서 제외
    const importantStops = day.items
      .map((item) => {
        const placeName = (item.place || '').trim();
        const activityName = (item.activity || '').toLowerCase();
        
        // 조식, 점심, 저녁 항목은 경로에서 제외
        const mealKeywords = ['조식', '점심', '저녁', 'breakfast', 'lunch', 'dinner'];
        if (mealKeywords.some(keyword => 
          placeName.toLowerCase().includes(keyword) || 
          activityName.includes(keyword)
        )) {
          return '';
        }
        
        if (!placeName) return '';

        const destinationName = (planData?.destination || '').trim();
        const query = destinationName ? `${placeName} ${destinationName}` : placeName;

        // 혹시 들어 있을 수 있는 추가 괄호 설명은 제거
        return extractPlaceForRoute(query);
      })
      .filter((name) => name.length > 0)
      .filter((name) => !EXCLUDE_KEYWORDS.some((keyword) => name.includes(keyword)));

    // 추천 숙소 지역과 공항명을 결합하여 최종 경로 스탑 구성
    let routeStops: string[] = [];

    const hasAccommodation = !!accommodationArea;
    const hasAirport = !!airportName;

    if (hasAccommodation || hasAirport) {
      if (totalDays <= 0) {
        // 안전장치: totalDays가 유효하지 않으면 기본 로직으로 처리
        routeStops = [...importantStops];
      } else if (dayIndex === 0) {
        // 첫째 날: [공항, ...중요 장소들, 숙소]
        if (hasAirport && hasAccommodation) {
          routeStops = [airportName, ...importantStops, accommodationArea];
        } else if (hasAirport) {
          routeStops = [airportName, ...importantStops];
        } else if (hasAccommodation) {
          routeStops = [accommodationArea, ...importantStops];
        }
      } else if (dayIndex === totalDays - 1) {
        // 마지막 날: [숙소, ...중요 장소들, 공항]
        if (hasAirport && hasAccommodation) {
          routeStops = [accommodationArea, ...importantStops, airportName];
        } else if (hasAirport) {
          routeStops = [...importantStops, airportName];
        } else if (hasAccommodation) {
          routeStops = [...importantStops, accommodationArea];
        }
      } else {
        // 중간 날: [숙소, ...중요 장소들, 숙소] (공항은 개입하지 않음)
        if (hasAccommodation) {
          routeStops = [accommodationArea, ...importantStops, accommodationArea];
        } else {
          routeStops = [...importantStops];
        }
      }
    } else {
      // 숙소/공항 정보가 없으면 중요 장소들만 사용
      routeStops = [...importantStops];
    }

    // 빈 값 제거
    routeStops = routeStops.filter((name) => name && name.length > 0);

    // 최소 2개 이상이어야 출발/도착이 의미 있음
    if (routeStops.length < 2) {
      return null;
    }

    const originName = routeStops[0];
    const destinationName = routeStops[routeStops.length - 1];
    const waypointNames = routeStops.slice(1, -1);

    const originParam = encodeURIComponent(originName);
    const destinationParam = encodeURIComponent(destinationName);

    // Google Maps 형식: api=1 + origin/destination/waypoints (텍스트 기반) + 도보 이동 모드
    let url = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destinationParam}`;

    if (waypointNames.length > 0) {
      const waypointsParam = waypointNames
        .map((name) => encodeURIComponent(name))
        .join('%7C'); // 파이프(|)를 %7C로 직접 연결
      url += `&waypoints=${waypointsParam}`;
    }

    // 도보(Walking) 경로로 명시
    url += '&dir_action=navigate&travelmode=walking';

    return url;
  };

  // 장소 이름에서 키워드를 추출하는 함수
  const extractPlaceKeywords = (placeName: string): { korean: string[]; english: string[] } => {
    const lowerPlaceName = placeName.toLowerCase();
    const keywords: { korean: string[]; english: string[] } = { korean: [], english: [] };
    
    // 장소 타입 키워드 매핑 (한국어 -> 영어)
    const placeTypeMapping: Record<string, { korean: string[]; english: string[] }> = {
      // 공원/정원
      '공원': { korean: ['공원', '파크', '정원'], english: ['park', 'garden', 'park view'] },
      '파크': { korean: ['공원', '파크'], english: ['park', 'park view'] },
      '정원': { korean: ['정원', '공원'], english: ['garden', 'park'] },
      'park': { korean: ['공원', '파크'], english: ['park', 'park view'] },
      
      // 건물/타워
      '빌딩': { korean: ['빌딩', '건물'], english: ['building', 'tower', 'skyscraper'] },
      '건물': { korean: ['건물', '빌딩'], english: ['building', 'architecture'] },
      '타워': { korean: ['타워', '빌딩'], english: ['tower', 'building'] },
      'building': { korean: ['건물', '빌딩'], english: ['building', 'architecture'] },
      'tower': { korean: ['타워'], english: ['tower', 'building'] },
      
      // 박물관/미술관
      '박물관': { korean: ['박물관', '미술관'], english: ['museum', 'gallery'] },
      '미술관': { korean: ['미술관', '박물관'], english: ['gallery', 'museum'] },
      'museum': { korean: ['박물관'], english: ['museum', 'gallery'] },
      'gallery': { korean: ['미술관'], english: ['gallery', 'museum'] },
      
      // 거리/시장
      '거리': { korean: ['거리', '시장'], english: ['street', 'market', 'street view'] },
      '시장': { korean: ['시장', '거리'], english: ['market', 'street'] },
      'street': { korean: ['거리'], english: ['street', 'street view'] },
      'market': { korean: ['시장'], english: ['market', 'street'] },
      
      // 사원/성당/교회
      '사원': { korean: ['사원', '절'], english: ['temple', 'shrine'] },
      '성당': { korean: ['성당', '교회'], english: ['cathedral', 'church'] },
      '교회': { korean: ['교회', '성당'], english: ['church', 'cathedral'] },
      'temple': { korean: ['사원'], english: ['temple'] },
      'cathedral': { korean: ['성당'], english: ['cathedral'] },
      'church': { korean: ['교회'], english: ['church'] },
      
      // 광장/스퀘어
      '광장': { korean: ['광장'], english: ['square', 'plaza'] },
      'square': { korean: ['광장'], english: ['square', 'plaza'] },
      'plaza': { korean: ['광장'], english: ['plaza', 'square'] },
      
      // 해변/바다
      '해변': { korean: ['해변', '바다'], english: ['beach', 'coast'] },
      '바다': { korean: ['바다', '해변'], english: ['coast', 'beach'] },
      'beach': { korean: ['해변'], english: ['beach', 'coast'] },
      
      // 산/산책로
      '산': { korean: ['산', '산책로'], english: ['mountain', 'trail'] },
      'mountain': { korean: ['산'], english: ['mountain'] },
    };
    
    // 장소 이름에서 키워드 추출
    for (const [key, values] of Object.entries(placeTypeMapping)) {
      if (lowerPlaceName.includes(key.toLowerCase())) {
        keywords.korean.push(...values.korean);
        keywords.english.push(...values.english);
        break; // 첫 번째 매치만 사용
      }
    }
    
    // 중복 제거
    keywords.korean = [...new Set(keywords.korean)];
    keywords.english = [...new Set(keywords.english)];
    
    return keywords;
  };

  // 구글 지도 이미지 로드 함수 (단일 이미지 URL 반환 - 일정 항목용)
  // 주의: /api/fetch-google-maps-image API는 Google Maps HTML을 크롤링/파싱하여
  //       <img decoding="async" src="https://lh3.googleusercontent.com/..."> 패턴의 이미지를
  //       최우선으로 선택합니다. 이 방식은 Google 약관 변경에 따라 언제든지 동작이 바뀔 수 있으며,
  //       상용 환경에서는 Google Maps 공식 API 사용을 우선적으로 고려해야 합니다.
  const fetchGoogleMapsImageForActivity = async (place: string, destination: string): Promise<string | null> => {
    try {
      // 구글 지도 검색 URL 생성
      const placeOrActivity = (place && place.trim() !== '' ? place : '') || '';
      if (!placeOrActivity) return null;
      
      // 장소 이름에서 키워드 추출
      const extractedKeywords = extractPlaceKeywords(placeOrActivity);
      
      // 전경/건물/장소 우선 키워드 (한국어/영어)
      const preferredKeywords = [
        // 한국어 키워드
        '외관',
        '전경',
        '경치',
        '건물',
        '장소',
        '거리',
        '공원',
        '뷰',
        '전망',
        // 영어 키워드
        'exterior',
        'building',
        'view',
        'landscape',
        'street',
        'park',
        'place',
        'location',
        'architecture',
        'facade',
        'panorama',
        'cityscape',
        'skyline',
      ];
      
      // 기본 검색어 구성
      const baseKeyword = `${placeOrActivity} ${destination}`.trim();
      
      // 우선순위 검색어 변형 목록 생성
      const searchKeywords: string[] = [];
      
      // 1순위: 장소 이름에서 추출한 키워드 + 전경 키워드
      if (extractedKeywords.english.length > 0) {
        for (const keyword of extractedKeywords.english.slice(0, 2)) {
          searchKeywords.push(`${baseKeyword} ${keyword} view`.trim());
          searchKeywords.push(`${baseKeyword} ${keyword} exterior`.trim());
          searchKeywords.push(`${baseKeyword} ${keyword}`.trim());
        }
      }
      if (extractedKeywords.korean.length > 0) {
        for (const keyword of extractedKeywords.korean.slice(0, 2)) {
          searchKeywords.push(`${baseKeyword} ${keyword} 전경`.trim());
          searchKeywords.push(`${baseKeyword} ${keyword}`.trim());
        }
      }
      
      // 2순위: 일반 전경/건물 키워드 조합
      searchKeywords.push(`${baseKeyword} exterior view`.trim());
      searchKeywords.push(`${baseKeyword} building exterior`.trim());
      searchKeywords.push(`${baseKeyword} view`.trim());
      searchKeywords.push(`${baseKeyword} exterior`.trim());
      searchKeywords.push(`${baseKeyword} 건물`.trim());
      searchKeywords.push(`${baseKeyword} 전경`.trim());
      
      // 3순위: 기본 검색어
      searchKeywords.push(baseKeyword);
      
      // 중복 제거
      const uniqueSearchKeywords = [...new Set(searchKeywords)];
      
      // 각 검색어 변형으로 시도 (우선순위 순서대로)
      for (const searchKeyword of uniqueSearchKeywords) {
        const encodedQuery = encodeURIComponent(searchKeyword);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
        
        // API 호출하여 이미지 추출
        const response = await fetch('/api/fetch-google-maps-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mapsUrl }),
        });
        
        if (!response.ok) {
          continue; // 다음 검색어 시도
        }
        
        const data = await response.json();
        
        if (data.success && data.imageUrl) {
          console.log(`[구글 지도 이미지 로드 성공] "${searchKeyword}"`);
          return data.imageUrl;
        }
        
        // 짧은 대기 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return null;
    } catch (error) {
      console.warn(`[구글 지도 이미지 로드] 오류:`, error);
      return null;
    }
  };

  // 검색어 기반 Google 지도 대표 이미지 로더 (활동별 함수의 래퍼)
  // query: "장소 이름 (도시, 국가)" 또는 place/activity 문자열
  const fetchGoogleMapImage = async (query: string, destination: string): Promise<string | null> => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    return fetchGoogleMapsImageForActivity(trimmed, destination);
  };

  // 타임아웃이 있는 fetch 래퍼 함수 (공통)
  const fetchWithTimeout = async (url: string, timeout: number = 10000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Wikimedia 이미지 로드 함수 (단일 이미지 URL 반환 - 일정 항목용, 필터링 강화)
  const fetchWikimediaImageForActivity = async (query: string): Promise<string | null> => {
    if (!query || query.trim() === '') return null;
    
    // 파일명 필터링 함수: 적절한 사진 파일인지 확인 (강화된 버전)
    const isAppropriateImageFile = (fileName: string): boolean => {
      const lowerFileName = fileName.toLowerCase();
      
      // 비사진 확장자 제외 (무조건 건너뛰기)
      const excludedExtensions = ['.svg', '.ogg', '.webm', '.mp3', '.pdf', '.swf', '.flv', '.avi', '.mov'];
      if (excludedExtensions.some(ext => lowerFileName.endsWith(ext))) {
        return false;
      }
      
      // 비사진/부적절 키워드 제외 (무조건 건너뛰기)
      const excludedKeywords = [
        'map',
        'logo',
        'diagram',
        'sketch',
        'plan',
        'icon',
        'symbol',
        'chart',
        'graph',
        'drawing',
        'illustration',
        // 단일 객체/인물 중심 사진 제외
        'portrait',
        'selfie',
        'person',
        'people',
        'face',
        'closeup',
        'close-up',
        'headshot',
        'car',
        'vehicle',
        'bus',
        'truck',
        // 음식/음료 중심 이미지 제외
        'food',
        'dish',
        'meal',
        'dining',
        'coffee',
        'tea',
        'latte',
        'espresso',
        // 시즌 장식/트리 등 특정 물품
        'christmas tree',
        'xmas tree',
        'christmas',
      ];
      if (excludedKeywords.some(keyword => lowerFileName.includes(keyword))) {
        return false;
      }
      
      // 사진 확장자 확인
      const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      return photoExtensions.some(ext => lowerFileName.endsWith(ext));
    };
    
    // 파일 확장자 및 키워드 우선순위 점수 계산 (높을수록 우선)
    const getFilePriorityScore = (fileName: string): number => {
      const lowerFileName = fileName.toLowerCase();
      let score = 0;
      
      // 확장자 점수 (기본 점수)
      if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) {
        score += 3;
      } else if (lowerFileName.endsWith('.png')) {
        score += 2;
      } else if (lowerFileName.endsWith('.webp') || lowerFileName.endsWith('.gif')) {
        score += 1;
      }
      
      // 전경/건물/장소 키워드 점수 (높은 점수 추가)
      const preferredKeywords = [
        // 영어 키워드 (우선순위 높음)
        'exterior',
        'building',
        'facade',
        'street view',
        'panorama',
        'cityscape',
        'skyline',
        'landscape',
        'architecture',
        'view',
        'street',
        'park',
        'location',
        'place',
        'landmark',
        'exterior view',
        'building exterior',
        // 한국어 키워드
        '외관',
        '전경',
        '경치',
        '건물',
        '장소',
        '거리',
        '공원',
        '뷰',
        '전망',
      ];
      
      // 키워드가 포함된 경우 점수 추가 (중요 키워드일수록 높은 점수)
      for (let i = 0; i < preferredKeywords.length; i++) {
        const keyword = preferredKeywords[i].toLowerCase();
        if (lowerFileName.includes(keyword)) {
          // 앞쪽 키워드일수록 높은 점수 부여
          const keywordScore = Math.max(10 - Math.floor(i / 3), 3);
          score += keywordScore;
        }
      }
      
      return score;
    };
    
    // 이미지 URL 유효성 검증
    const validateImageUrl = async (url: string): Promise<boolean> => {
      try {
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        return true; // CORS 제한으로 실제 검증은 어렵지만, URL 형식은 유효하다고 가정
      } catch {
        return url.startsWith('http://') || url.startsWith('https://');
      }
    };
    
    // 내부 헬퍼 함수: 실제 이미지 검색 및 URL 가져오기 (강화된 필터링 및 우선순위 선택)
    const searchImage = async (searchTerm: string, limit: number = 20): Promise<string | null> => {
      try {
        // 1단계: 파일 검색 (검색 결과 수 최소 5개 이상, 기본값 20개)
        const searchLimit = Math.max(5, limit);
        const encodedQuery = encodeURIComponent(searchTerm);
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srnamespace=6&srlimit=${searchLimit}&format=json&origin=*`;
        
        const searchResponse = await fetchWithTimeout(searchUrl, 10000);
        if (!searchResponse.ok) {
          console.warn(`[이미지 검색] HTTP 오류: ${searchResponse.status} for "${searchTerm}"`);
          return null;
        }
        
        const searchData = await searchResponse.json();
        const searchResults = searchData.query?.search;
        
        if (!searchResults || searchResults.length === 0) {
          console.warn(`[이미지 검색] 검색 결과 없음: "${searchTerm}"`);
          return null;
        }
        
        // 2단계: 검색 결과 중 적절한 사진 파일 찾기 및 우선순위별 정렬
        const candidateFiles: Array<{ fileName: string; priority: number }> = [];
        
        for (const result of searchResults) {
          const fileName = result.title.replace('File:', '');
          
          // 필터링: 적절한 사진 파일인지 확인
          if (!isAppropriateImageFile(fileName)) {
            continue; // 건너뛰기
          }
          
          // 우선순위 점수 계산
          const priority = getFilePriorityScore(fileName);
          candidateFiles.push({ fileName, priority });
        }
        
        // 우선순위 점수 기준으로 정렬 (높은 점수 우선)
        candidateFiles.sort((a, b) => b.priority - a.priority);
        
        // 3단계: 우선순위가 높은 파일부터 실제 이미지 파일 URL 요청
        for (const candidate of candidateFiles) {
          const fileName = candidate.fileName;
          
          try {
            // 실제 이미지 파일 URL 요청
            const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
            
            const imageResponse = await fetchWithTimeout(imageInfoUrl, 8000);
            if (!imageResponse.ok) {
              continue;
            }
            
            const imageData = await imageResponse.json();
            const pages = imageData.query?.pages;
            
            if (!pages) continue;
            
            // 이미지 URL 추출
            const pageId = Object.keys(pages)[0];
            const imageInfo = pages[pageId]?.imageinfo;
            
            if (imageInfo && imageInfo.length > 0 && imageInfo[0].url) {
              const imageUrl = imageInfo[0].url;
              // URL 유효성 검증
              if (await validateImageUrl(imageUrl)) {
                console.log(`[이미지 선택] 우선순위 ${candidate.priority}: "${fileName}"`);
                return imageUrl;
              }
            }
          } catch (error) {
            console.warn(`[이미지 URL 추출] 오류 for "${fileName}":`, error);
            continue; // 다음 후보 시도
          }
        }
        
        return null;
      } catch (error) {
        // 네트워크 오류나 타임아웃 등 다양한 에러 처리
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn(`[이미지 검색] 타임아웃: "${searchTerm}"`);
          } else {
            console.warn(`[이미지 검색] 오류: "${searchTerm}" - ${error.message}`);
          }
        } else {
          console.warn(`[이미지 검색] 알 수 없는 오류: "${searchTerm}"`);
        }
        return null;
      }
    };
    
    // 검색어 정리 및 변형
    const cleanQuery = query.trim();
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
    
    // 장소 이름에서 키워드 추출 (place 또는 activity에서)
    const extractedKeywords = extractPlaceKeywords(cleanQuery);
    
    // 전경/건물/장소 우선 키워드 (한국어/영어)
    const preferredKeywords = [
      // 영어 키워드 (우선순위 높음)
      'exterior view',
      'building exterior',
      'facade',
      'street view',
      'panorama',
      'cityscape',
      'skyline',
      'landscape',
      'architecture',
      'exterior',
      'building',
      'view',
      'street',
      'park',
      'location',
      'place',
      'landmark',
      // 한국어 키워드
      '외관',
      '전경',
      '경치',
      '건물',
      '장소',
      '거리',
      '공원',
      '뷰',
      '전망',
    ];
    
    // 다양한 검색어 조합 시도 (장소 이름 키워드 우선, 전경/건물 키워드 차순)
    const searchVariations: string[] = [];
    
    // 1순위: 장소 이름에서 추출한 키워드 + 전경 키워드
    if (extractedKeywords.english.length > 0) {
      for (const keyword of extractedKeywords.english.slice(0, 2)) {
        searchVariations.push(`${cleanQuery} ${keyword} view`.trim());
        searchVariations.push(`${cleanQuery} ${keyword} exterior`.trim());
        searchVariations.push(`${cleanQuery} ${keyword}`.trim());
      }
    }
    if (extractedKeywords.korean.length > 0) {
      for (const keyword of extractedKeywords.korean.slice(0, 2)) {
        searchVariations.push(`${cleanQuery} ${keyword} 전경`.trim());
        searchVariations.push(`${cleanQuery} ${keyword}`.trim());
      }
    }
    
    // 2순위: 일반 전경/건물 키워드 포함 검색어
    searchVariations.push(`${cleanQuery} ${preferredKeywords[0]}`.trim()); // exterior view
    searchVariations.push(`${cleanQuery} ${preferredKeywords[1]}`.trim()); // building exterior
    searchVariations.push(`${cleanQuery} ${preferredKeywords[2]}`.trim()); // facade
    searchVariations.push(`${cleanQuery} ${preferredKeywords[3]}`.trim()); // street view
    searchVariations.push(`${cleanQuery} ${preferredKeywords[4]}`.trim()); // panorama
    searchVariations.push(`${cleanQuery} ${preferredKeywords[5]}`.trim()); // cityscape
    searchVariations.push(`${cleanQuery} ${preferredKeywords[9]}`.trim()); // exterior
    searchVariations.push(`${cleanQuery} ${preferredKeywords[10]}`.trim()); // building
    searchVariations.push(`${cleanQuery} ${preferredKeywords[11]}`.trim()); // view
    searchVariations.push(`${cleanQuery} ${preferredKeywords[17]}`.trim()); // 외관
    searchVariations.push(`${cleanQuery} ${preferredKeywords[18]}`.trim()); // 전경
    searchVariations.push(`${cleanQuery} ${preferredKeywords[19]}`.trim()); // 경치
    searchVariations.push(`${cleanQuery} ${preferredKeywords[20]}`.trim()); // 건물
    
    // 3순위: 일반 검색어
    searchVariations.push(`${cleanQuery} photograph`);
    searchVariations.push(`${cleanQuery} photo`);
    searchVariations.push(`${cleanQuery} landmark`);
    searchVariations.push(`${cleanQuery} architecture`);
    searchVariations.push(cleanQuery); // 원본
    searchVariations.push(...queryWords.slice(0, 3).map(w => w)); // 주요 단어만
    if (queryWords.length > 1) {
      searchVariations.push(queryWords[0]); // 첫 번째 단어만
      searchVariations.push(queryWords.join(' ')); // 공백으로 연결
    }
    
    // 중복 제거
    const uniqueVariations = [...new Set(searchVariations)];
    
    // 각 검색어 변형으로 시도 (순차적으로)
    for (const searchTerm of uniqueVariations) {
      if (!searchTerm || searchTerm.trim() === '') continue;
      
      // 검색 결과 수를 점진적으로 증가 (최소 5개 이상)
      for (const limit of [20, 10, 5]) {
        const imageUrl = await searchImage(searchTerm, limit);
        if (imageUrl) {
          console.log(`[이미지 로드 성공] "${query}" -> "${searchTerm}" (limit: ${limit})`);
          return imageUrl;
        }
      }
      
      // 짧은 대기 시간 (API 제한 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn(`[이미지 로드 실패] 모든 시도 실패: "${query}"`);
    return null;
  };

  // Wikimedia 이미지 로드 함수 (다중 이미지 URL 배열 반환)
  const fetchWikimediaImages = async (query: string): Promise<string[]> => {
    if (!query || query.trim() === '') return [];
    
    // 이미지 크기 추출 함수 (URL에서 크기 파라미터 확인)
    const getImageSize = (url: string): number => {
      const widthMatch = url.match(/[=](\d+)px/);
      const sizeMatch = url.match(/[=](\d+)/);
      if (widthMatch) {
        return parseInt(widthMatch[1]);
      }
      if (sizeMatch) {
        return parseInt(sizeMatch[1]);
      }
      return 0;
    };
    
    // 이미지 우선순위 점수 계산 (크기가 클수록 높은 점수 + 장소/전경 키워드 우선)
    const getImagePriority = (url: string, fileName: string): number => {
      const size = getImageSize(url);
      const lowerFileName = fileName.toLowerCase();
      
      // 고화질 키워드가 있으면 추가 점수
      let priority = size;
      if (lowerFileName.includes('high') || lowerFileName.includes('hd') || 
          lowerFileName.includes('4k') || lowerFileName.includes('high resolution')) {
        priority += 5000;
      }
      
      // 큰 이미지 우선 (최소 1920px 이상)
      if (size >= 1920) {
        priority += 10000;
      } else if (size >= 1280) {
        priority += 5000;
      }

      // 장소/전경/건물 관련 키워드에 가중치 부여
      const positiveKeywords = [
        'building',
        'tower',
        'bridge',
        'street',
        'avenue',
        'boulevard',
        'square',
        'platz',
        'plaza',
        'skyline',
        'cityscape',
        'city view',
        'landmark',
        'cathedral',
        'church',
        'palace',
        'castle',
        'gate',
        'gatehouse',
        'square',
        'market square',
        'old town',
        'city center',
        'downtown',
        'exterior',
        'front view',
        'main view',
        'panorama',
        'panoramic',
        'view',
      ];

      const negativeKeywords = [
        // 음식/물품
        'food',
        'meal',
        'dish',
        'plate',
        'menu',
        'restaurant interior',
        'cafe interior',
        'kitchen',
        'table setting',
        'drink',
        'cocktail',
        'beer',
        'wine',
        // 사람/초상
        'portrait',
        'selfie',
        'group photo',
        'people',
        'person',
        'tourist',
        // 그림/회화/예술품
        'painting',
        'drawing',
        'sketch',
        'watercolor',
        'oil on canvas',
        'artwork',
        'illustration',
        'poster',
        'flyer',
        // 옛날/저채도 사진
        'black and white',
        'black-and-white',
        'b&w',
        'old photograph',
        'historical photo',
        'vintage photo',
      ];

      if (positiveKeywords.some((k) => lowerFileName.includes(k))) {
        priority += 4000;
      }

      if (negativeKeywords.some((k) => lowerFileName.includes(k))) {
        priority -= 6000;
      }
      
      return priority;
    };
    
    // 내부 헬퍼 함수: 실제 이미지 검색 및 URL 배열 가져오기 (고화질 우선)
    const searchImages = async (searchTerm: string, limit: number = 10): Promise<Array<{ url: string; priority: number; fileName: string }>> => {
      try {
        // 1단계: 파일 검색 (더 많은 후보 확보, 최소 7개 이상)
        const searchLimit = Math.max(limit, 7);
        const encodedQuery = encodeURIComponent(searchTerm);
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srnamespace=6&srlimit=${searchLimit}&format=json&origin=*`;
        
        const searchResponse = await fetchWithTimeout(searchUrl, 10000);
        if (!searchResponse.ok) {
          console.warn(`[Wikimedia 검색] HTTP 오류: ${searchResponse.status}`);
          return [];
        }
        
        const searchData = await searchResponse.json();
        const searchResults = searchData.query?.search;
        
        if (!searchResults || searchResults.length === 0) return [];
        
        // 중복 파일 제목 제거 (Set 사용)
        const seenFileTitles = new Set<string>();
        const uniqueSearchResults: typeof searchResults = [];
        
        for (const result of searchResults) {
          const fileTitle = result.title; // "File:Berlin_skyline.jpg" 형식
          
          // 중복 파일 제목 체크 (정확히 동일한 파일 제목은 한 번만 포함)
          if (seenFileTitles.has(fileTitle)) {
            continue;
          }
          
          // 유사성 파일 제거 로직: 복제본이나 변형본 패턴 제거
          const lowerTitle = fileTitle.toLowerCase();
          const isDuplicatePattern = 
            /\s*\(2\)/i.test(fileTitle) ||           // " (2)" 패턴
            /\s*-\s*copy/i.test(lowerTitle) ||       // " - Copy" 패턴
            /\s*-\s*panorama/i.test(lowerTitle) ||   // " - Panorama" 패턴
            /\s*-\s*version\s*\d+/i.test(lowerTitle) || // " - Version 2" 패턴
            /\s*-\s*\d+$/i.test(fileTitle) ||        // " - 2" 패턴 (끝에 숫자)
            /copy\s*\d+/i.test(lowerTitle);          // "Copy 2" 패턴
          
          if (isDuplicatePattern) {
            continue; // 유사성 파일 건너뛰기
          }
          
          seenFileTitles.add(fileTitle);
          uniqueSearchResults.push(result);
        }
        
        // 여러 검색 결과에서 이미지 파일 URL 배열 수집 (크기 정보 포함)
        const imageCandidates: Array<{ url: string; priority: number; fileName: string }> = [];
        
        for (const result of uniqueSearchResults) {
          const fileName = result.title.replace('File:', '');
          
          // 비사진/원하지 않는 파일 제외
          const lowerFileName = fileName.toLowerCase();
          const isNonPhotoExt = lowerFileName.endsWith('.svg') || lowerFileName.endsWith('.ogg') || lowerFileName.endsWith('.webm');
          const hasNonPhotoKeyword =
            lowerFileName.includes('map') ||
            lowerFileName.includes('logo') ||
            lowerFileName.includes('diagram') ||
            lowerFileName.includes('icon') ||
            lowerFileName.includes('symbol') ||
            lowerFileName.includes('flag') ||
            lowerFileName.includes('coat of arms') ||
            lowerFileName.includes('emblem') ||
            lowerFileName.includes('chart') ||
            lowerFileName.includes('graph');

          // 음식/물품/그림/저채도 옛날 사진 키워드 포함 파일 제외
          const unwantedContentKeywords = [
            // 음식/물품
            'food',
            'meal',
            'dish',
            'plate',
            'menu',
            'restaurant interior',
            'cafe interior',
            'kitchen',
            'table setting',
            'drink',
            'cocktail',
            'beer',
            'wine',
            'dessert',
            'cake',
            'pastry',
            // 사람/초상
            'portrait',
            'selfie',
            'group photo',
            'people',
            'tourist',
            // 그림/회화/예술품
            'painting',
            'drawing',
            'sketch',
            'watercolor',
            'artwork',
            'illustration',
            'poster',
            'flyer',
            'stamp',
            // 옛날/저채도 사진
            'black and white',
            'black-and-white',
            'b&w',
            'old photograph',
            'historical photo',
            'vintage photo',
          ];

          const hasUnwantedContent = unwantedContentKeywords.some((k) =>
            lowerFileName.includes(k.toLowerCase())
          );

          if (isNonPhotoExt || hasNonPhotoKeyword || hasUnwantedContent) {
            continue;
          }
          
          // 2단계: 실제 이미지 파일 URL 요청 (크기 정보 포함)
          try {
            const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url|size&format=json&origin=*`;
            
            const imageResponse = await fetchWithTimeout(imageInfoUrl, 8000);
            if (!imageResponse.ok) continue;
            
            const imageData = await imageResponse.json();
            const pages = imageData.query?.pages;
            
            if (!pages) continue;
            
            // 이미지 URL 추출
            const pageId = Object.keys(pages)[0];
            const imageInfo = pages[pageId]?.imageinfo;
            
            if (imageInfo && imageInfo.length > 0 && imageInfo[0].url) {
              const url = imageInfo[0].url;
              const size = imageInfo[0].width || 0;
              
              // 최소 크기 필터링 (너무 작은 이미지 제외 - 최소 800px)
              if (size >= 800) {
                const priority = getImagePriority(url, fileName);
                imageCandidates.push({ url, priority, fileName });
              }
            }
          } catch (error) {
            // 개별 이미지 정보 요청 실패 시 건너뛰기
            continue;
          }
        }
        
        // 우선순위 순으로 정렬 (높은 점수 우선)
        imageCandidates.sort((a, b) => b.priority - a.priority);
        
        return imageCandidates;
      } catch (error) {
        // 네트워크 오류나 타임아웃 등 다양한 에러 처리
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn(`[Wikimedia 검색] 타임아웃: "${searchTerm}"`);
          } else {
            console.warn(`[Wikimedia 검색] 오류: "${searchTerm}" - ${error.message}`);
          }
        } else {
          console.warn(`[Wikimedia 검색] 알 수 없는 오류: "${searchTerm}"`);
        }
        return [];
      }
    };
    
    // 고화질 이미지 검색 (원본 쿼리 + 고화질 키워드)
    const queryLower = query.toLowerCase();
    const hasHighRes = queryLower.includes('high') || queryLower.includes('hd') || 
                       queryLower.includes('4k') || queryLower.includes('high resolution');
    
    let imageCandidates: Array<{ url: string; priority: number; fileName: string }> = [];
    
    // 1순위: 원본 쿼리로 검색
    const originalCandidates = await searchImages(query, 10);
    imageCandidates.push(...originalCandidates);
    
    // 2순위: 고화질 키워드가 없으면 추가하여 검색
    if (!hasHighRes && imageCandidates.length < 5) {
      const highResCandidates = await searchImages(`${query} high resolution`, 10);
      imageCandidates.push(...highResCandidates);
    }
    
    // 3순위: 전경 키워드 추가 검색
    if (!queryLower.includes('skyline') && !queryLower.includes('cityscape') && !queryLower.includes('city view')) {
      const skylineCandidates = await searchImages(`${query} skyline`, 10);
      const cityscapeCandidates = await searchImages(`${query} cityscape`, 10);
      const cityViewCandidates = await searchImages(`${query} city view`, 10);
      
      imageCandidates.push(...skylineCandidates, ...cityscapeCandidates, ...cityViewCandidates);
    }
    
    // 중복 제거 (강화된 로직)
    // Wikimedia Commons URL 구조 분석 및 다중 기준 중복 제거
    
    // 1. 파일명 추출 함수 (다양한 URL 형식 지원)
    const extractFileName = (url: string, fileName: string): string => {
      // 파일명에서 확장자 추출
      const fileExtMatch = fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i);
      const extension = fileExtMatch ? fileExtMatch[1].toLowerCase() : '';
      
      // 파일명에서 실제 파일명 부분만 추출 (숫자, 크기 정보 제거)
      // 예: "800px-Berlin_skyline.jpg" -> "berlin_skyline"
      // 예: "Berlin_skyline_1200px.jpg" -> "berlin_skyline"
      let cleanFileName = fileName
        .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '') // 확장자 제거
        .replace(/^\d+px[-_]?/i, '') // 앞의 크기 정보 제거 (예: "800px-")
        .replace(/[-_]\d+px$/i, '') // 뒤의 크기 정보 제거 (예: "_1200px")
        .replace(/\d+px[-_]?/gi, '') // 중간의 크기 정보 제거
        .toLowerCase()
        .trim();
      
      // 색감/버전 변형을 줄이기 위해 공통 키워드/숫자 접미어 제거
      const colorVariationKeywords = [
        'day',
        'night',
        'sunset',
        'sunrise',
        'dawn',
        'dusk',
        'noir',
        'sepia',
        'bw',
      ];

      colorVariationKeywords.forEach((kw) => {
        if (cleanFileName.endsWith(`_${kw}`) || cleanFileName.endsWith(`-${kw}`)) {
          cleanFileName = cleanFileName.replace(new RegExp(`${kw}$`), '');
        }
      });

      return cleanFileName + (extension ? `.${extension}` : '');
    };
    
    // 2. URL에서 실제 파일 경로 추출
    const extractBaseImagePath = (url: string): string | null => {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // /thumb/ 경로가 있으면 원본 경로로 변환
        // 예: /commons/thumb/A/B/C/file.jpg/800px-file.jpg -> /commons/A/B/C/file.jpg
        if (pathname.includes('/thumb/')) {
          const thumbMatch = pathname.match(/\/thumb\/(.+?)\/(\d+px-.+)$/);
          if (thumbMatch) {
            return `/commons/${thumbMatch[1]}`;
          }
        }
        
        // thumb가 없으면 원본 경로 그대로 사용
        const commonsMatch = pathname.match(/\/commons\/(.+)$/);
        if (commonsMatch) {
          return `/commons/${commonsMatch[1]}`;
        }
        
        return null;
      } catch (e) {
        return null;
      }
    };
    
    // 3. 다중 기준 중복 제거 (파일명 + 기본 경로)
    const imageMap = new Map<string, { url: string; priority: number; fileName: string }>();
    const seenFileNames = new Set<string>();
    const seenBasePaths = new Set<string>();
    
    for (const candidate of imageCandidates) {
      // 파일명 기반 중복 체크
      const cleanFileName = extractFileName(candidate.url, candidate.fileName);
      const basePath = extractBaseImagePath(candidate.url);
      
      // 중복 체크 키 생성 (파일명 우선, 없으면 기본 경로, 둘 다 없으면 URL)
      let duplicateKey: string | null = null;
      
      if (cleanFileName && cleanFileName.length > 3) {
        // 파일명이 유효하면 파일명으로 중복 체크
        duplicateKey = `filename:${cleanFileName}`;
      } else if (basePath) {
        // 파일명이 없으면 기본 경로로 중복 체크
        duplicateKey = `path:${basePath}`;
      } else {
        // 둘 다 없으면 URL 전체로 비교 (쿼리 파라미터 제거)
        const urlWithoutQuery = candidate.url.split('?')[0];
        duplicateKey = `url:${urlWithoutQuery}`;
      }
      
      if (!duplicateKey) {
        // 키 생성 실패 시 URL 전체 사용
        duplicateKey = `url:${candidate.url}`;
      }
      
      // 중복 체크 및 우선순위 비교
      if (!imageMap.has(duplicateKey)) {
        imageMap.set(duplicateKey, candidate);
        if (cleanFileName) seenFileNames.add(cleanFileName);
        if (basePath) seenBasePaths.add(basePath);
      } else {
        // 기존 항목과 우선순위 비교하여 더 높은 것으로 교체
        const existing = imageMap.get(duplicateKey)!;
        if (candidate.priority > existing.priority) {
          imageMap.set(duplicateKey, candidate);
        }
      }
    }
    
    // 중복 제거된 후보 배열 생성
    const uniqueCandidates = Array.from(imageMap.values());
    
    // 우선순위 재정렬
    uniqueCandidates.sort((a, b) => b.priority - a.priority);
    
    // 최대 5개까지만 선택 (고화질 우선)
    const topCandidates = uniqueCandidates.slice(0, 5);
    
    // 최종 이미지 URL 배열 생성 및 URL 중복 제거 (Set 사용)
    const finalImageUrls = Array.from(
      new Set(topCandidates.map(item => item.url))
    );
    
    // 최대 5개로 제한
    return finalImageUrls.slice(0, 5);
  };

  // 도시 대표 이미지 로드
  useEffect(() => {
    if (planData?.summary?.destination_image_query && planData.summary.destination_image_query.trim() !== '') {
      setImageLoading(true);
      setDestinationImageUrls([]); // 이전 이미지 초기화
      setCurrentImageIndex(0); // 인덱스 초기화
      
      fetchWikimediaImages(planData.summary.destination_image_query.trim())
        .then((urls) => {
          if (urls && urls.length > 0) {
            setDestinationImageUrls(urls);
            setCurrentImageIndex(0);
          }
          setImageLoading(false);
        })
        .catch((error) => {
          console.error('이미지 로드 실패:', error);
          setDestinationImageUrls([]);
          setImageLoading(false);
        });
    } else {
      // destination_image_query가 없으면 이미지 로딩 상태 해제
      setDestinationImageUrls([]);
      setCurrentImageIndex(0);
      setImageLoading(false);
    }
  }, [planData?.summary?.destination_image_query]);

  // 캐러셀 네비게이션 함수
  const nextImage = () => {
    if (destinationImageUrls.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % destinationImageUrls.length);
    }
  };

  const prevImage = () => {
    if (destinationImageUrls.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + destinationImageUrls.length) % destinationImageUrls.length);
    }
  };

  const goToImage = (index: number) => {
    if (index >= 0 && index < destinationImageUrls.length) {
      setCurrentImageIndex(index);
    }
  };

  // 일정 항목별 이미지 로드
  useEffect(() => {
    if (!planData?.days) return;
    
    // 모든 일정 항목을 순회하며 이미지 로드
    planData.days.forEach((day, dayIndex) => {
      day.items.forEach((item, itemIndex) => {
        const itemKey = `${dayIndex}-${itemIndex}`;
        
        // image_search_link가 있으면 이미지를 로드해야 함 (activity_image_query가 있으면 우선 사용, 없으면 place/activity로 검색)
        // 단, 단순 식사(특별한 지정 장소가 아닌 일반 식사) 일정은 이미지 로드 생략
        const isSimpleMeal = isSimpleMealActivity(item);
        const shouldLoadImage = !isSimpleMeal && item.image_search_link && item.image_search_link.trim() !== '';
        
        if (shouldLoadImage) {
          // 이미 로드 중이거나 로드 완료된 항목은 건너뛰기
          setItemImages(prev => {
            if (prev[itemKey]?.loading || prev[itemKey]?.url) {
              return prev; // 이미 로드 중이거나 완료된 경우 변경 없음
            }
            
            // 로딩 상태 설정
            return {
              ...prev,
              [itemKey]: { url: null, loading: true }
            };
          });
          
          // 이미지 쿼리 결정: activity_image_query가 있으면 우선 사용, 없으면 place나 activity 사용
          let imageQuery = '';
          if (item.activity_image_query && item.activity_image_query.trim() !== '') {
            imageQuery = item.activity_image_query.trim();
          } else {
            // place나 activity를 사용하여 검색어 생성 (장소 타입별 키워드 추가)
            const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
            if (placeOrActivity) {
              const placeLower = placeOrActivity.toLowerCase();
              const activityLower = (item.activity || '').toLowerCase();
              
              // 장소 타입별 키워드 추가
              let typeKeywords = 'photograph';
              
              // 박물관/미술관
              if (placeLower.includes('museum') || placeLower.includes('gallery') || placeLower.includes('박물관') || placeLower.includes('미술관')) {
                typeKeywords = 'museum exterior photograph';
              }
              // 공원/정원
              else if (placeLower.includes('park') || placeLower.includes('garden') || placeLower.includes('공원') || placeLower.includes('정원')) {
                typeKeywords = 'park scenic view photograph';
              }
              // 시장/음식거리
              else if (placeLower.includes('market') || placeLower.includes('시장') || activityLower.includes('시장') || activityLower.includes('음식')) {
                typeKeywords = 'market scene photograph';
              }
              // 카페/레스토랑
              else if (placeLower.includes('cafe') || placeLower.includes('restaurant') || placeLower.includes('카페') || placeLower.includes('레스토랑') || placeLower.includes('식당')) {
                typeKeywords = 'exterior photograph';
              }
              // 구역/광장/거리
              else if (placeLower.includes('square') || placeLower.includes('district') || placeLower.includes('street') || placeLower.includes('광장') || placeLower.includes('거리')) {
                typeKeywords = 'panoramic view photograph';
              }
              // 건물/랜드마크
              else {
                typeKeywords = 'exterior full view photograph';
              }
              
              imageQuery = `${placeOrActivity} ${planData.destination} ${typeKeywords}`;
            }
          }
          
          // 이미지 로드 함수 (지도 보기 링크 우선, 구글 지도 검색, 위키미디어 폴백)
          const loadImage = async (): Promise<void> => {
            // 1순위: 지도 보기 링크(image_search_link)에서 직접 이미지 추출 시도
            if (item.image_search_link && item.image_search_link.trim() !== '') {
              try {
                const mapsUrl = item.image_search_link.trim();
                // Google Maps URL인지 확인
                if (mapsUrl.includes('google.com') && mapsUrl.includes('/maps/')) {
                  const response = await fetch('/api/fetch-google-maps-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mapsUrl }),
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.imageUrl) {
                      // 지도 보기 링크에서 이미지 추출 성공 - 이미지 유효성 검증
                      const img = new window.Image();
                      
                      const timeout = setTimeout(() => {
                        if (!img.complete) {
                          img.onerror = null;
                          loadGoogleMapsSearchAsFallback();
                        }
                      }, 10000);
                      
                      img.onload = () => {
                        clearTimeout(timeout);
                        setItemImages(prev => ({
                          ...prev,
                          [itemKey]: { url: data.imageUrl, loading: false }
                        }));
                      };
                      
                      img.onerror = () => {
                        clearTimeout(timeout);
                        loadGoogleMapsSearchAsFallback();
                      };
                      
                      img.src = data.imageUrl;
                      return;
                    }
                  }
                }
              } catch (error) {
                console.warn(`[지도 보기 링크 이미지 추출 오류]:`, error);
              }
            }
            
            // 2순위: 구글 지도 검색 기반 이미지 로드
            loadGoogleMapsSearchAsFallback();
          };
          
          // 구글 지도 검색 기반 이미지 로드 (폴백 함수)
          const loadGoogleMapsSearchAsFallback = async (): Promise<void> => {
            const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
            const destination = planData.destination || '';
            
            if (placeOrActivity && destination) {
              try {
                const googleImageUrl = await fetchGoogleMapsImageForActivity(placeOrActivity, destination);
                
                if (googleImageUrl) {
                  // 구글 지도 이미지 로드 성공 - 이미지 유효성 검증
                  const img = new window.Image();
                  
                  const timeout = setTimeout(() => {
                    if (!img.complete) {
                      img.onerror = null;
                      loadWikimediaImageAsFallback();
                    }
                  }, 10000);
                  
                  img.onload = () => {
                    clearTimeout(timeout);
                    setItemImages(prev => ({
                      ...prev,
                      [itemKey]: { url: googleImageUrl, loading: false }
                    }));
                  };
                  
                  img.onerror = () => {
                    clearTimeout(timeout);
                    loadWikimediaImageAsFallback();
                  };
                  
                  img.src = googleImageUrl;
                  return;
                }
              } catch (error) {
                console.warn(`[구글 지도 이미지 로드 오류] ${placeOrActivity}:`, error);
              }
            }
            
            // 3순위: 위키미디어 이미지 로드 (폴백)
            loadWikimediaImageAsFallback();
          };
          
          // 위키미디어 이미지 로드 (폴백 함수)
          const loadWikimediaImageAsFallback = async (): Promise<void> => {
            if (!imageQuery) {
              setItemImages(prev => ({
                ...prev,
                [itemKey]: { url: null, loading: false }
              }));
              return;
            }
            
            try {
              const wikimediaUrl = await fetchWikimediaImageForActivity(imageQuery);
              
              if (wikimediaUrl) {
                // 위키미디어 이미지 로드 성공
                const img = new window.Image();
                img.onload = () => {
                  setItemImages(prev => ({
                    ...prev,
                    [itemKey]: { url: wikimediaUrl, loading: false }
                  }));
                };
                img.onerror = () => {
                  setItemImages(prev => ({
                    ...prev,
                    [itemKey]: { url: null, loading: false }
                  }));
                };
                
                img.src = wikimediaUrl;
              } else {
                // 위키미디어 이미지도 실패
                setItemImages(prev => ({
                  ...prev,
                  [itemKey]: { url: null, loading: false }
                }));
              }
            } catch (error) {
              console.warn(`[위키미디어 이미지 로드 오류]:`, error);
              setItemImages(prev => ({
                ...prev,
                [itemKey]: { url: null, loading: false }
              }));
            }
          };
          
          // 이미지 로드 시작 (지도 보기 링크 우선, 구글 지도 검색, 위키미디어 폴백)
          loadImage();
        }
      });
    });
  }, [planData]);

  // 각 일차의 경로를 기반으로 현지 이동비 계산
  useEffect(() => {
    if (!planData?.days || !planData.destination) return;

    const calculateTransportCosts = async () => {
      const updatedDays = await Promise.all(
        planData.days.map(async (day, dayIndex) => {
          // 이미 계산된 이동비가 있으면 스킵
          if (day.daily_transport_cost !== undefined && day.daily_transport_cost > 0) {
            return day;
          }

          // 일차의 경로 추출 (getDayDirectionsUrl과 동일한 로직)
          const importantStops = day.items
            .map((item) => {
              const placeName = (item.place || '').trim();
              if (!placeName) return '';

              const destinationName = (planData.destination || '').trim();
              const query = destinationName ? `${placeName} ${destinationName}` : placeName;
              return extractPlaceForRoute(query);
            })
            .filter((name) => name.length > 0)
            .filter((name) => !EXCLUDE_KEYWORDS.some((keyword) => name.includes(keyword)));

          const totalDays = planData.days.length;
          const hasAccommodation = !!accommodationArea;
          const hasAirport = !!airportName;

          let routeStops: string[] = [];

          if (hasAccommodation || hasAirport) {
            if (dayIndex === 0) {
              if (hasAirport && hasAccommodation) {
                routeStops = [airportName, ...importantStops, accommodationArea];
              } else if (hasAirport) {
                routeStops = [airportName, ...importantStops];
              } else if (hasAccommodation) {
                routeStops = [accommodationArea, ...importantStops];
              }
            } else if (dayIndex === totalDays - 1) {
              if (hasAirport && hasAccommodation) {
                routeStops = [accommodationArea, ...importantStops, airportName];
              } else if (hasAirport) {
                routeStops = [...importantStops, airportName];
              } else if (hasAccommodation) {
                routeStops = [...importantStops, accommodationArea];
              }
            } else {
              if (hasAccommodation) {
                routeStops = [accommodationArea, ...importantStops, accommodationArea];
              } else {
                routeStops = [...importantStops];
              }
            }
          } else {
            routeStops = [...importantStops];
          }

          // 빈 값 제거
          routeStops = routeStops.filter((name) => name && name.length > 0);

          // 최소 2개 이상이어야 이동비 계산 가능
          if (routeStops.length < 2) {
            return { ...day, daily_transport_cost: 0 };
          }

          try {
            const response = await fetch('/api/calculate-transport-cost', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                destination: planData.destination,
                route: routeStops,
                people: 1, // 기본값 1명
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const transportCost = data.total_cost || 0;
              return { ...day, daily_transport_cost: transportCost };
            }
          } catch (error) {
            console.error(`[일차 ${dayIndex + 1} 현지 이동비 계산 오류]:`, error);
          }

          return { ...day, daily_transport_cost: 0 };
        })
      );

      // 현지 이동비가 업데이트된 경우 planData 업데이트
      const hasChanges = updatedDays.some((day, index) => 
        day.daily_transport_cost !== planData.days[index]?.daily_transport_cost
      );

      if (hasChanges) {
        const updatedPlanData = {
          ...planData,
          days: updatedDays,
        };
        
        // 일차별 예산 업데이트 (항목 cost 합 + 현지 이동비)
        const daysWithUpdatedCosts = updatedPlanData.days.map((day) => {
          const itemsCostSum = day.items.reduce((sum, item) => sum + (item.cost || 0), 0);
          const transportCost = day.daily_transport_cost || 0;
          return {
            ...day,
            daily_estimated_cost: Math.round(itemsCostSum + transportCost),
          };
        });
        
        const planDataWithUpdatedCosts = {
          ...updatedPlanData,
          days: daysWithUpdatedCosts,
        };
        
        // 예산 분류 업데이트 (일별 현지 이동비 합산 반영)
        const finalPlanData = updateBudgetFromItemCosts(planDataWithUpdatedCosts);
        setPlanData(finalPlanData);
      }
    };

    calculateTransportCosts();
  }, [planData?.days, planData?.destination, accommodationArea, airportName]);

  // 티켓 검색 링크에서 가격 크롤링 및 cost 업데이트
  useEffect(() => {
    if (!planData?.days) return;
    
    planData.days.forEach((day, dayIndex) => {
      day.items.forEach((item, itemIndex) => {
        // 티켓 검색 링크가 있고 cost가 0이거나 없으면 가격 크롤링
        if (item.purchase_search_link && item.purchase_search_link.trim() !== '' && (!item.cost || item.cost === 0)) {
          const itemKey = `${dayIndex}-${itemIndex}`;
          
          // Klook URL인지 확인
          const klookUrl = item.purchase_search_link.trim();
          if (klookUrl.includes('klook.com')) {
            // 가격 크롤링
            (async () => {
              try {
                const response = await fetch('/api/fetch-klook-price', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: klookUrl }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.price) {
                    // cost 업데이트 및 예산 재계산
                    setPlanData(prev => {
                      if (!prev) return prev;
                      const updatedDays = [...prev.days];
                      updatedDays[dayIndex] = {
                        ...updatedDays[dayIndex],
                        items: updatedDays[dayIndex].items.map((it, idx) => 
                          idx === itemIndex ? { ...it, cost: data.price } : it
                        ),
                      };
                      const updatedPlanData = { ...prev, days: updatedDays };
                      // 예산 재계산
                      return updateBudgetFromItemCosts(updatedPlanData);
                    });
                  }
                }
              } catch (error) {
                console.warn(`[Klook 가격 크롤링 오류] ${item.place}:`, error);
              }
            })();
          }
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planData?.days]);

  // localStorage에 이미 저장되어 있는지 확인
  useEffect(() => {
    if (planData?.planId) {
      const savedKey = `tripgenie_plan_${planData.planId}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        setSaved(true);
      }
    }
  }, [planData]);

  useEffect(() => {
    // 이미 로드했으면 다시 로드하지 않음
    if (hasLoadedRef.current || typeof window === 'undefined') return;

    const key = searchParams.get('key');
    if (!key) {
      hasLoadedRef.current = true;
      return;
    }

    // localStorage에서 가져오기 (강화된 재시도 로직)
    let retryCount = 0;
    const maxRetries = 20; // 최대 2초 대기 (20 * 100ms)
    
    const loadResult = () => {
      // 이미 로드했으면 중단
      if (hasLoadedRef.current) return;
      
      const savedData = localStorage.getItem(key);
      if (savedData) {
        try {
          let data: PlanData = JSON.parse(savedData);
          
          // 초기 로드 시 검증 및 보정: 일차별 예산 = 항목 비용 합 + 현지 이동비
          const validatedDays = data.days.map((day) => {
            const itemsCostSum = day.items.reduce((sum, item) => sum + (item.cost || 0), 0);
            const transportCost = day.daily_transport_cost || 0;
            const calculatedDailyCost = itemsCostSum + transportCost;
            
            // 일차별 예산 = 항목 cost 합 + 현지 이동비
            return {
              ...day,
              daily_estimated_cost: Math.round(calculatedDailyCost),
            };
          });
          
          // 검증된 일정으로 업데이트
          data = {
            ...data,
            days: validatedDays,
          };
          
          // 예산 분류 업데이트 (각 항목 cost 합산으로)
          data = updateBudgetFromItemCosts(data);
          
          setPlanData(data);
          // 초기 항공편 시간 설정
          if (data.arrivalTime) {
            setInputArrivalTime(data.arrivalTime);
          }
          if (data.departureTime) {
            setInputDepartureTime(data.departureTime);
          }
          hasLoadedRef.current = true;
          // 사용 후 삭제 (약간의 지연을 두어 안정성 확보)
          setTimeout(() => {
            localStorage.removeItem(key);
          }, 1000);
        } catch (error) {
          console.error('Failed to parse plan data:', error);
          hasLoadedRef.current = true;
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          // 100ms마다 재시도
          setTimeout(loadResult, 100);
        } else {
          hasLoadedRef.current = true;
        }
      }
    };

    // 즉시 시도
    loadResult();
  }, [searchParams]);

  // 계획 저장 함수
  const handleSavePlan = () => {
    if (!planData) return;

    try {
      const savedKey = `tripgenie_plan_${planData.planId}`;
      const planDataToSave = {
        ...planData,
        savedAt: Date.now(), // 저장 시간 추가
      };
      
      localStorage.setItem(savedKey, JSON.stringify(planDataToSave));
      setSaved(true);
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('계획 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.');
    }
  };

  const handleCopy = () => {
    if (planData) {
      const text = JSON.stringify(planData, null, 2);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    window.close();
  };

  // CSV 다운로드 함수
  const handleDownloadCSV = () => {
    if (!planData) return;

    // CSV 헤더
    const headers = ['일자', '날짜', '시간', '장소', '활동', '예상 비용 (원)', '이동 시간', '비고'];
    
    // CSV 데이터 행 생성
    const rows: string[][] = [];
    
    planData.days.forEach((day, dayIndex) => {
      day.items.forEach((item) => {
        const dateLabel = format(parseISO(day.date), 'yyyy-MM-dd', { locale: ko });
        const dayLabel = `${dayIndex + 1}일차`;
        
        rows.push([
          dayLabel,
          dateLabel,
          item.time || '',
          item.place || '',
          item.activity || '',
          item.cost ? item.cost.toString() : '',
          item.next_move_duration || '',
          item.notes || '',
        ]);
      });
      
      // 날짜별 구분선 추가 (선택사항)
      if (dayIndex < planData.days.length - 1) {
        rows.push(['', '', '', '', '', '', '', '']);
      }
    });

    // CSV 내용 생성 (BOM 추가로 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // CSV에서 쉼표, 따옴표, 줄바꿈 처리를 위한 인용부호 추가
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    // Blob 생성 및 다운로드
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${planData.destination}_여행계획_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // 예산 재조정 및 항공편 시간 반영 함수 (통합)
  const handleRebalanceBudget = async () => {
    if (!planData) {
      setRebalanceError('계획 정보가 없습니다.');
      return;
    }

    // 입력값 검증
    const hasPriceInput = realFlightCost.trim() || realAccommodationCost.trim();
    const hasTimeInput = inputArrivalTime || inputDepartureTime;
    
    if (!hasPriceInput && !hasTimeInput) {
      setRebalanceError('항공권/숙박 가격 또는 항공편 시간 중 하나 이상 입력해주세요.');
      return;
    }

    // 가격 입력값 검증 (입력된 경우)
    let flightCostNum = 0;
    let accommodationCostNum = 0;
    
    if (hasPriceInput) {
      if (!planData.estimated_budget) {
        setRebalanceError('예산 정보가 없습니다.');
        return;
      }

      const flightCost = realFlightCost.trim();
      const accommodationCost = realAccommodationCost.trim();

      if (!flightCost || !accommodationCost) {
        setRebalanceError('항공권 가격과 숙박 비용을 모두 입력해주세요.');
        return;
      }

      flightCostNum = Number(flightCost);
      accommodationCostNum = Number(accommodationCost);

      if (isNaN(flightCostNum) || isNaN(accommodationCostNum) || flightCostNum < 0 || accommodationCostNum < 0) {
        setRebalanceError('유효한 숫자를 입력해주세요.');
        return;
      }
    }

    setRebalancing(true);
    setRebalanceError(null);
    setRebalanceSuccess(false);

    try {
      let updatedPlanData = { ...planData };
      
      // 1. 예산 재조정 (가격이 입력된 경우)
      if (hasPriceInput && planData.estimated_budget) {
        const response = await fetch('/api/rebalance-budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalBudget: planData.estimated_budget,
            realFlightCost: flightCostNum,
            realAccommodationCost: accommodationCostNum,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '예산 재조정 실패');
        }

        // 새로운 estimated_budget로 업데이트 (총 예산 포함)
        if (data.estimated_budget) {
          const originalBreakdown = planData.estimated_budget.breakdown || {};
          const newBreakdown = data.estimated_budget.breakdown || {};
          
          // 항공권과 숙박 비용의 차이 계산
          const originalFlightCost = originalBreakdown.flight_cost || 0;
          const originalAccommodationCost = originalBreakdown.accommodation_cost || 0;
          const newFlightCost = newBreakdown.flight_cost || 0;
          const newAccommodationCost = newBreakdown.accommodation_cost || 0;
          
          const flightCostDiff = newFlightCost - originalFlightCost;
          const accommodationCostDiff = newAccommodationCost - originalAccommodationCost;
          
          // 일차별 비용 업데이트 (항공권/숙박 비용 차이 반영)
          const totalDays = planData.days.length;
          const updatedDays = planData.days.map((day, index) => {
            const originalDailyCost = day.daily_estimated_cost || 0;
            let updatedDailyCost = originalDailyCost;
            
            // 항공권 비용: 일반적으로 첫날에 포함
            if (index === 0) {
              updatedDailyCost += flightCostDiff;
            }
            
            // 숙박 비용: 각 날에 균등 분산 (마지막 날 제외)
            if (index < totalDays - 1) {
              const dailyAccommodationDiff = accommodationCostDiff / (totalDays - 1);
              updatedDailyCost += dailyAccommodationDiff;
            }
            
            // 음수 방지
            updatedDailyCost = Math.max(0, updatedDailyCost);
            
            // 일차별 예산 = 항목별 cost 합계 + 현지 이동비
            const itemsCostSum = day.items.reduce((sum, item) => sum + (item.cost || 0), 0);
            const transportCost = day.daily_transport_cost || 0;
            const calculatedDailyCost = itemsCostSum + transportCost;
            
            // 일차별 예산 업데이트 (항목 cost 합 + 현지 이동비)
            const finalDailyCost = calculatedDailyCost > 0 ? calculatedDailyCost : updatedDailyCost;
            
            return {
              ...day,
              daily_estimated_cost: Math.round(finalDailyCost),
              items: day.items,
            };
          });
          
          updatedPlanData = {
            ...updatedPlanData,
            estimated_budget: data.estimated_budget,
            days: updatedDays,
          };
        }
      }

      // 2. 항공편 시간 반영 (시간이 입력된 경우)
      if (hasTimeInput) {
        // 마지막 날 시간 공백 처리를 위해 비동기 처리
        const processDays = async () => {
          const processedDays = await Promise.all(
            updatedPlanData.days.map(async (day) => {
              const dayDate = day.date;
              const isFirstDay = dayDate === planData.startDate;
              const isLastDay = dayDate === planData.endDate;

              if (isFirstDay && inputArrivalTime) {
            // 첫날: 도착 시각 이후로 일정 시작
            const arrivalHour = parseInt(inputArrivalTime.split(':')[0]);
            const arrivalMin = parseInt(inputArrivalTime.split(':')[1]);
            
            // 공항에서 출발하여 첫 활동 장소까지 이동 시간 고려 (기본 1시간)
            const firstActivityHour = arrivalHour + 1;
            const firstActivityTime = `${firstActivityHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`;
            
            // 공항 관련 활동 식별 함수 (공항 도착/출발은 제외하되, 공항으로 이동은 포함)
            const isAirportArrivalOrDeparture = (item: DayItem): boolean => {
              const airportArrivalKeywords = ['공항 도착', 'airport arrival', '공항 도착지', '도착지 공항'];
              const airportDepartureKeywords = ['공항 출발', 'airport departure', '공항 출발지', '출발지 공항', '탑승'];
              const place = (item.place || '').toLowerCase();
              const activity = (item.activity || '').toLowerCase();
              
              // 공항 도착 관련 (제거 대상)
              if (airportArrivalKeywords.some(keyword => 
                place.includes(keyword.toLowerCase()) || 
                activity.includes(keyword.toLowerCase())
              )) {
                return true;
              }
              
              // 공항 출발 관련 (제거 대상)
              if (airportDepartureKeywords.some(keyword => 
                place.includes(keyword.toLowerCase()) || 
                activity.includes(keyword.toLowerCase())
              )) {
                return true;
              }
              
              return false;
            };
            
            // 공항으로 이동하는 일정은 포함하되, 사진/예약 링크만 제거
            const isAirportMovement = (item: DayItem): boolean => {
              const airportMovementKeywords = ['공항으로', '공항으로 이동', 'airport', '공항'];
              const place = (item.place || '').toLowerCase();
              const activity = (item.activity || '').toLowerCase();
              
              // 공항 도착/출발이 아닌 경우에만 이동으로 판단
              if (!isAirportArrivalOrDeparture(item)) {
                return airportMovementKeywords.some(keyword => 
                  (place.includes(keyword.toLowerCase()) && !place.includes('도착') && !place.includes('출발')) || 
                  (activity.includes(keyword.toLowerCase()) && !activity.includes('도착') && !activity.includes('출발'))
                );
              }
              
              return false;
            };
            
            // 첫날 일정 중 도착 시각 이전의 항목 제거 또는 시간 조정 (중요도 기반)
            // 공항 도착/출발 항목만 제거, 공항으로 이동은 포함
            
            // 중요도 기반으로 정렬: 낮은 중요도부터 먼저 제거 대상으로 고려
            const itemsToProcess = day.items
              .map((item, index) => ({
                ...item,
                originalIndex: index,
                priority: item.priority_score ?? 10, // 기본값 10점 (낮은 중요도)
              }))
              .sort((a, b) => a.priority - b.priority); // 낮은 중요도 우선 정렬
            
            const arrivalTimeInMinutes = arrivalHour * 60 + arrivalMin;
            const firstActivityTimeInMinutes = arrivalTimeInMinutes + 60; // 도착 시간 + 1시간 (짐 픽업 및 공항에서 시내 이동 시간)
            
            const updatedItems = itemsToProcess
              .filter((item) => {
                // 공항 도착/출발 관련 항목만 제거
                if (isAirportArrivalOrDeparture(item)) {
                  return false;
                }
                
                // 도착 시각 + 1시간 이전의 항목 처리
                const [itemHour, itemMin] = item.time.split(':').map(Number);
                const itemTimeInMinutes = itemHour * 60 + itemMin;
                
                // 도착 시각 + 1시간 이후면 유지
                if (itemTimeInMinutes >= firstActivityTimeInMinutes) {
                  return true;
                }
                
                // 도착 시각 + 1시간 이전이면 모두 제거 (절대 유지하지 않음)
                // 중요도와 관계없이 도착 시간 + 1시간 이전의 항목은 삭제
                return false;
              })
              .map((item) => {
                // 중요도는 제거하고 원본 속성만 반환
                const { originalIndex, priority, ...itemWithoutExtra } = item;
                return itemWithoutExtra;
              })
              .sort((a, b) => {
                // 원래 시간 순서대로 재정렬
                const [aHour, aMin] = a.time.split(':').map(Number);
                const [bHour, bMin] = b.time.split(':').map(Number);
                return (aHour * 60 + aMin) - (bHour * 60 + bMin);
              })
              .map((item, itemIndex) => {
                // 첫 번째 항목의 시간을 도착 시각 + 1시간 이후로 확실히 설정
                if (itemIndex === 0) {
                  const [itemHour, itemMin] = item.time.split(':').map(Number);
                  const itemTimeInMinutes = itemHour * 60 + itemMin;
                  
                  if (itemTimeInMinutes < firstActivityTimeInMinutes) {
                    // 도착 시각 + 1시간 이후로 조정
                    const updatedItem = {
                      ...item,
                      time: firstActivityTime,
                    };
                    
                    // 공항으로 이동하는 일정이면 링크 제거
                    if (isAirportMovement(updatedItem)) {
                      updatedItem.image_search_link = '';
                      updatedItem.official_website_link = '';
                      updatedItem.purchase_search_link = '';
                      updatedItem.activity_image_query = '';
                    }
                    
                    return updatedItem;
                  }
                }
                
                // 공항으로 이동하는 일정이면 링크만 제거 (일정은 유지)
                if (isAirportMovement(item)) {
                  return {
                    ...item,
                    image_search_link: '',
                    official_website_link: '',
                    purchase_search_link: '',
                    activity_image_query: '',
                  };
                }
                
                return item;
              });

            // 첫날 일정도 시간 순서대로 정렬
            let sortedItems = [...updatedItems].sort((a, b) => {
              const [aHour, aMin] = a.time.split(':').map(Number);
              const [bHour, bMin] = b.time.split(':').map(Number);
              const aTimeInMinutes = aHour * 60 + aMin;
              const bTimeInMinutes = bHour * 60 + bMin;
              return aTimeInMinutes - bTimeInMinutes;
            });

            // 여행지 공항부터 시내로 이동하는 흐름을 유지하기 위한 연결성 보강
            const hasAirportArrival = sortedItems.some((item) =>
              isAirportArrivalOrDeparture(item)
            );
            const hasAirportMovement = sortedItems.some((item) =>
              isAirportMovement(item)
            );

            const finalItemsForFirstDay: DayItem[] = [...sortedItems];

            // 1) 공항 도착 일정이 없으면 추가
            if (!hasAirportArrival) {
              finalItemsForFirstDay.unshift({
                time: inputArrivalTime,
                place: `${planData.destination} 공항`,
                activity: '여행지 공항 도착 및 입국 수속',
                notes: '',
                cost: 0,
                next_move_duration: '',
                priority_score: 5,
                image_search_link: '',
                activity_image_query: '',
                official_website_link: '',
                purchase_search_link: '',
              });
            }

            // 2) 공항에서 시내/숙소로 이동하는 일정이 없으면 추가
            if (!hasAirportMovement) {
              finalItemsForFirstDay.push({
                time: firstActivityTime,
                place: `${planData.destination} 공항`,
                activity: '공항에서 숙소/도심으로 이동',
                notes: '',
                cost: 0,
                next_move_duration: '',
                priority_score: 8,
                image_search_link: '',
                activity_image_query: '',
                official_website_link: '',
                purchase_search_link: '',
              });
            }

            // 최종 정렬 (시각 기준)
            sortedItems = [...finalItemsForFirstDay].sort((a, b) => {
              const [aHour, aMin] = a.time.split(':').map(Number);
              const [bHour, bMin] = b.time.split(':').map(Number);
              const aTimeInMinutes = aHour * 60 + aMin;
              const bTimeInMinutes = bHour * 60 + bMin;
              return aTimeInMinutes - bTimeInMinutes;
            });

            // 첫째날 일정 변경 비용 계산 (추가/삭제된 일정 식별 및 비용 산정)
            const originalFirstDay = planData.days.find(d => d.date === day.date);
            const originalFirstDayItems = originalFirstDay?.items || [];
            
            // 일정 비교를 위한 키 생성 함수
            const getItemKey = (item: DayItem): string => {
              return `${item.time || ''}|${item.place || ''}|${item.activity || ''}`;
            };
            
            // 원본 일정 키 맵 생성
            const originalItemKeys = new Set(originalFirstDayItems.map(getItemKey));
            const originalItemMap = new Map(originalFirstDayItems.map(item => [getItemKey(item), item]));
            
            // 새 일정 키 맵 생성
            const newItemKeys = new Set(sortedItems.map(getItemKey));
            
            // 추가된 일정과 삭제된 일정 식별
            const addedItems = sortedItems.filter(item => !originalItemKeys.has(getItemKey(item)));
            const removedItems = originalFirstDayItems.filter(item => !newItemKeys.has(getItemKey(item)));
            
            // 삭제된 일정의 비용 합산
            const removedCost = removedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
            
            // 추가된 일정에 대한 비용 산정 (Google API 사용)
            let addedCost = 0;
            if (addedItems.length > 0) {
              // cost가 0이거나 없는 추가된 일정만 비용 산정
              const itemsToEstimate = addedItems.filter(item => !item.cost || item.cost === 0);
              
              if (itemsToEstimate.length > 0) {
                try {
                  const costResponse = await fetch('/api/estimate-activity-cost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      destination: planData.destination,
                      activities: itemsToEstimate.map(item => ({
                        place: item.place || '',
                        activity: item.activity || '',
                        notes: item.notes || '',
                      })),
                      people: 1, // 기본값 1명 사용
                    }),
                  });
                  
                  if (costResponse.ok) {
                    const costData = await costResponse.json();
                    if (costData.costs && Array.isArray(costData.costs)) {
                      // 비용 산정 결과를 일정에 반영
                      costData.costs.forEach((costInfo: any, index: number) => {
                        const itemIndex = sortedItems.findIndex(item => 
                          itemsToEstimate[index] && 
                          getItemKey(item) === getItemKey(itemsToEstimate[index])
                        );
                        if (itemIndex >= 0) {
                          sortedItems[itemIndex] = {
                            ...sortedItems[itemIndex],
                            cost: costInfo.cost || 0,
                          };
                        }
                      });
                      
                      addedCost = costData.costs.reduce((sum: number, costInfo: any) => sum + (costInfo.cost || 0), 0);
                      console.log(`[첫째날 비용 산정] ${itemsToEstimate.length}개 일정에 대해 ${addedCost.toLocaleString()}원 산정`);
                    }
                  }
                } catch (error) {
                  console.error('[첫째날 비용 산정] 오류:', error);
                  // 오류 발생 시 기존 cost 합산 사용
                  addedCost = addedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                }
              } else {
                // 이미 cost가 있는 경우 기존 cost 사용
                addedCost = addedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
              }
            }
            
            // 비용 차이 계산 (추가/삭제된 일정의 실제 비용 차이)
            const firstDayCostDiff = addedCost - removedCost;
            
            // 첫째날 일일 예산 계산: 항목별 cost 합계 + 현지 이동비
            const itemsCostSum = sortedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
            const transportCost = day.daily_transport_cost || 0;
            const updatedFirstDayCost = itemsCostSum + transportCost;

            return {
              ...day,
              items: sortedItems, // 각 항목의 cost는 실제 산정된 비용으로 업데이트됨
              daily_estimated_cost: Math.round(updatedFirstDayCost), // 일차별 예산 = 항목 cost 합 + 현지 이동비
              _costDiff: firstDayCostDiff, // 첫째날 비용 차이 저장
            };
              }

              if (isLastDay && inputDepartureTime) {
                // 마지막 날: 출발 시각 이전으로 일정 종료
                const departureHour = parseInt(inputDepartureTime.split(':')[0]);
                const departureMin = parseInt(inputDepartureTime.split(':')[1]);
                const departureTimeInMinutes = departureHour * 60 + departureMin;
                
                // 공항 도착 필요 시각: 귀국 항공편 출발 시각에서 최소 3시간을 뺀 시각
                const airportArrivalNeededInMinutes = departureTimeInMinutes - 180; // 3시간 = 180분
                const airportArrivalHour = Math.floor(airportArrivalNeededInMinutes / 60);
                const airportArrivalMin = airportArrivalNeededInMinutes % 60;
                
                // 최대 활동 가능 시각: 공항 도착 필요 시각에서 1시간 30분을 뺀 시각 (체크아웃 및 이동 준비 시간 포함)
                const maxActivityInMinutes = airportArrivalNeededInMinutes - 90; // 1시간 30분 = 90분
                const maxActivityHour = Math.floor(maxActivityInMinutes / 60);
                const maxActivityMin = maxActivityInMinutes % 60;
                const maxActivityTime = `${maxActivityHour.toString().padStart(2, '0')}:${maxActivityMin.toString().padStart(2, '0')}`;
                
                // 공항 도착/출발 식별 함수
                const isAirportArrivalOrDeparture = (item: DayItem): boolean => {
              const airportArrivalKeywords = ['공항 도착', 'airport arrival', '공항 도착지', '도착지 공항'];
              const airportDepartureKeywords = ['공항 출발', 'airport departure', '공항 출발지', '출발지 공항', '탑승'];
              const place = (item.place || '').toLowerCase();
              const activity = (item.activity || '').toLowerCase();
              
              // 공항 도착 관련 (제거 대상)
              if (airportArrivalKeywords.some(keyword => 
                place.includes(keyword.toLowerCase()) || 
                activity.includes(keyword.toLowerCase())
              )) {
                return true;
              }
              
              // 공항 출발 관련 (제거 대상)
              if (airportDepartureKeywords.some(keyword => 
                place.includes(keyword.toLowerCase()) || 
                activity.includes(keyword.toLowerCase())
              )) {
                return true;
              }
              
              return false;
            };
            
            // 공항으로 이동하는 일정은 포함하되, 사진/예약 링크만 제거
            const isAirportMovement = (item: DayItem): boolean => {
              const airportMovementKeywords = ['공항으로', '공항으로 이동', 'airport'];
              const place = (item.place || '').toLowerCase();
              const activity = (item.activity || '').toLowerCase();
              
              // 공항 도착/출발이 아닌 경우에만 이동으로 판단
              if (!isAirportArrivalOrDeparture(item)) {
                return airportMovementKeywords.some(keyword => 
                  (place.includes(keyword.toLowerCase()) && !place.includes('도착') && !place.includes('출발')) || 
                  (activity.includes(keyword.toLowerCase()) && !activity.includes('도착') && !activity.includes('출발'))
                );
              }
              
              return false;
            };
            
            // 마지막 날 일정 중 출발 시각 이후의 항목 제거 (중요도 기반)
            // 공항 도착/출발 항목만 제거, 공항으로 이동은 포함
            
            // 중요도 기반으로 정렬: 낮은 중요도부터 먼저 제거 대상으로 고려
            const itemsToProcess = day.items
              .map((item, index) => ({
                ...item,
                originalIndex: index,
                priority: item.priority_score ?? 10, // 기본값 10점 (낮은 중요도)
              }))
              .sort((a, b) => a.priority - b.priority); // 낮은 중요도 우선 정렬
            
            const updatedItems = itemsToProcess
              .filter((item) => {
                // 공항 도착/출발 관련 항목만 제거
                if (isAirportArrivalOrDeparture(item)) {
                  return false;
                }
                
                // 최대 활동 가능 시각 이후의 항목 중 중요도가 낮은 것부터 제거
                const [itemHour, itemMin] = item.time.split(':').map(Number);
                const itemTimeInMinutes = itemHour * 60 + itemMin;
                
                // 최대 활동 가능 시각 이전이면 유지
                if (itemTimeInMinutes <= maxActivityInMinutes) {
                  return true;
                }
                
                // 최대 활동 가능 시각 이후면 중요도 기준으로 판단
                // 80점 이상(최고 중요도)은 절대 삭제하지 않음 (시간 조정)
                if (item.priority >= 80) {
                  // 시간을 최대 활동 가능 시각으로 조정
                  return true;
                }
                
                // 60점 이상은 가능한 유지하려고 노력 (시간 조정 시도)
                if (item.priority >= 60) {
                  if (itemTimeInMinutes <= maxActivityInMinutes + 30) {
                    // 최대 활동 가능 시각 + 30분 이내면 조정 가능
                    return true;
                  }
                }
                
                // 60점 미만은 삭제 (낮은 중요도)
                return false;
              })
              .map((item) => {
                // 중요도는 제거하고 원본 속성만 반환
                const { originalIndex, priority, ...itemWithoutExtra } = item;
                return itemWithoutExtra;
              })
              .sort((a, b) => {
                // 원래 시간 순서대로 재정렬
                const [aHour, aMin] = a.time.split(':').map(Number);
                const [bHour, bMin] = b.time.split(':').map(Number);
                return (aHour * 60 + aMin) - (bHour * 60 + bMin);
              })
              .map((item) => {
                // 시간 조정: 최대 활동 가능 시각 이후인 항목은 시간 조정
                const [itemHour, itemMin] = item.time.split(':').map(Number);
                const itemTimeInMinutes = itemHour * 60 + itemMin;
                
                if (itemTimeInMinutes > maxActivityInMinutes) {
                  // 최대 활동 가능 시각으로 조정
                  const updatedItem = {
                    ...item,
                    time: maxActivityTime,
                  };
                  
                  // 공항으로 이동하는 일정이면 링크 제거
                  if (isAirportMovement(updatedItem)) {
                    updatedItem.image_search_link = '';
                    updatedItem.official_website_link = '';
                    updatedItem.purchase_search_link = '';
                    updatedItem.activity_image_query = '';
                  }
                  
                  return updatedItem;
                }
                
                // 공항으로 이동하는 일정이면 링크만 제거 (일정은 유지)
                if (isAirportMovement(item)) {
                  return {
                    ...item,
                    image_search_link: '',
                    official_website_link: '',
                    purchase_search_link: '',
                    activity_image_query: '',
                  };
                }
                return item;
              });

                // 공항 이동 일정을 제외한 일반 활동만 필터링 (시간 공백 계산용)
                const regularItemsBeforeAirport = updatedItems.filter(item => {
                  const place = (item.place || '').toLowerCase();
                  const activity = (item.activity || '').toLowerCase();
                  return !(place.includes('공항') || activity.includes('공항') || 
                          activity.includes('체크아웃') || activity.includes('체크아웃'));
                });
                
                // 마지막 일반 활동의 시간이 최대 활동 가능 시각 이전이 되도록 조정
                if (regularItemsBeforeAirport.length > 0) {
                  const lastItem = regularItemsBeforeAirport[regularItemsBeforeAirport.length - 1];
                  const [lastItemHour, lastItemMin] = lastItem.time.split(':').map(Number);
                  const lastItemTimeInMinutes = lastItemHour * 60 + lastItemMin;
                  
                  if (lastItemTimeInMinutes > maxActivityInMinutes) {
                    // 최대 활동 가능 시각으로 조정
                    regularItemsBeforeAirport[regularItemsBeforeAirport.length - 1] = {
                      ...lastItem,
                      time: maxActivityTime,
                    };
                  }
                }

                // 시간 공백(Gap) 계산 및 새로운 일정 생성
                let finalItems = [...regularItemsBeforeAirport];
                let gapScheduleAdded = false;
                
                if (regularItemsBeforeAirport.length > 0 && planData.estimated_budget) {
                  // 마지막 일반 활동 종료 시간 계산 (활동 소요 시간 1시간 가정)
                  const lastRegularItem = regularItemsBeforeAirport[regularItemsBeforeAirport.length - 1];
                  const [lastRegularHour, lastRegularMin] = lastRegularItem.time.split(':').map(Number);
                  const lastRegularEndTimeInMinutes = (lastRegularHour * 60 + lastRegularMin) + 60; // 1시간 후 종료 가정
                  
                  // 시간 공백 계산 (최대 활동 가능 시각 - 마지막 일반 활동 종료 시간)
                  const gapMinutes = maxActivityInMinutes - lastRegularEndTimeInMinutes;
                  
                  // 공백이 1시간(60분) 이상이면 새로운 일정 생성
                  if (gapMinutes >= 60) {
                    try {
                      // 공백 시작 시간 계산
                      const gapStartHour = Math.floor(lastRegularEndTimeInMinutes / 60);
                      const gapStartMin = lastRegularEndTimeInMinutes % 60;
                      const gapStartTime = `${gapStartHour.toString().padStart(2, '0')}:${gapStartMin.toString().padStart(2, '0')}`;
                      
                      // 공백 종료 시간 (최대 활동 가능 시각)
                      const gapEndTime = maxActivityTime;
                      
                      // 전체 일정의 모든 장소 목록 추출 (중복 제거)
                      const allPlacesMap = new Map<string, { place: string; activity: string; priority_score: number }>();
                      
                      // 전체 일정을 순회하며 장소 수집
                      updatedPlanData.days.forEach((d) => {
                        d.items.forEach((item) => {
                          if (item.place && item.place.trim() !== '') {
                            const key = `${item.place}|${item.activity}`;
                            if (!allPlacesMap.has(key)) {
                              allPlacesMap.set(key, {
                                place: item.place,
                                activity: item.activity || '',
                                priority_score: item.priority_score || 10,
                              });
                            }
                          }
                        });
                      });
                      
                      const allPlaces = Array.from(allPlacesMap.values());
                      
                      // 새로운 일정 생성 API 호출
                      const gapResponse = await fetch('/api/generate-gap-schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          destination: planData.destination,
                          gapStartTime,
                          gapEndTime,
                          date: day.date,
                          existingSchedule: regularItemsBeforeAirport.map(item => ({
                            time: item.time,
                            place: item.place || '',
                            activity: item.activity || '',
                            priority_score: item.priority_score || 10,
                          })),
                          allPlaces: allPlaces, // 전체 일정의 모든 장소 목록
                          budget: planData.estimated_budget,
                        }),
                      });
                      
                      if (gapResponse.ok) {
                        const gapData = await gapResponse.json();
                        
                        if (gapData.items && gapData.items.length > 0) {
                          // 생성된 일정을 일반 활동 뒤에 추가
                          finalItems = [...regularItemsBeforeAirport, ...gapData.items];
                          gapScheduleAdded = true;
                          
                          console.log(`[시간 공백 일정 생성] ${gapMinutes}분 공백에 ${gapData.items.length}개 일정 추가`);
                          console.log(`[시간 공백 일정 생성] 추가된 일정:`, gapData.items);
                        } else {
                          // 일정이 생성되지 않으면 일반 활동만 유지
                          finalItems = [...regularItemsBeforeAirport];
                        }
                      } else {
                        console.warn('[시간 공백 일정 생성] API 호출 실패:', await gapResponse.text());
                        // API 호출 실패 시 일반 활동만 유지
                        finalItems = [...regularItemsBeforeAirport];
                      }
                    } catch (error) {
                      console.error('[시간 공백 일정 생성] 오류:', error);
                      // 오류 발생 시 일반 활동만 유지
                      finalItems = [...regularItemsBeforeAirport];
                    }
                  } else {
                    // 시간 공백이 60분 미만이면 일반 활동만 유지
                    finalItems = [...regularItemsBeforeAirport];
                  }
                } else {
                  // 일반 활동이 없거나 예산 정보가 없으면 일반 활동만 유지
                  finalItems = [...regularItemsBeforeAirport];
                }
                
                // 공항 이동 일정을 마지막에 추가
                const airportMovementItem = {
                  time: maxActivityTime,
                  place: '숙소',
                  activity: '체크아웃 및 공항 이동 (공항버스/지하철/택시)',
                  notes: `공항 도착 예정: ${airportArrivalHour.toString().padStart(2, '0')}:${airportArrivalMin.toString().padStart(2, '0')}`,
                  cost: 0,
                  next_move_duration: '',
                  priority_score: 10,
                  image_search_link: '',
                  activity_image_query: '',
                  official_website_link: '',
                  purchase_search_link: '',
                };
                
                // 공항 이동 일정을 마지막에 추가 (이미 있으면 제거 후 추가)
                finalItems = finalItems.filter(item => {
                  const place = (item.place || '').toLowerCase();
                  const activity = (item.activity || '').toLowerCase();
                  return !(place.includes('공항') && activity.includes('체크아웃'));
                });
                finalItems.push(airportMovementItem);

                // 시간 공백 일정 추가 여부 확인 (나중에 비용 산정에 사용)
                let gapScheduleCost = 0;
                if (gapScheduleAdded && finalItems.length > regularItemsBeforeAirport.length) {
                  // 새로 추가된 일정(시간 공백 일정)의 비용 계산
                  const originalCount = regularItemsBeforeAirport.length;
                  const addedItems = finalItems.slice(originalCount, -1); // 마지막 공항 이동 일정 제외
                  gapScheduleCost = addedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                }

                // 최종 일정을 시간 순서대로 정렬
                const sortedFinalItems = [...finalItems].sort((a, b) => {
                  const [aHour, aMin] = a.time.split(':').map(Number);
                  const [bHour, bMin] = b.time.split(':').map(Number);
                  const aTimeInMinutes = aHour * 60 + aMin;
                  const bTimeInMinutes = bHour * 60 + bMin;
                  return aTimeInMinutes - bTimeInMinutes;
                });

                // 마지막 날 일정 변경 비용 계산 (추가/삭제된 일정 식별 및 비용 산정)
                const originalLastDay = planData.days.find(d => d.date === day.date);
                const originalLastDayItems = originalLastDay?.items || [];
                
                // 일정 비교를 위한 키 생성 함수
                const getItemKey = (item: DayItem): string => {
                  return `${item.time || ''}|${item.place || ''}|${item.activity || ''}`;
                };
                
                // 원본 일정 키 맵 생성
                const originalItemKeys = new Set(originalLastDayItems.map(getItemKey));
                const originalItemMap = new Map(originalLastDayItems.map(item => [getItemKey(item), item]));
                
                // 새 일정 키 맵 생성
                const newItemKeys = new Set(sortedFinalItems.map(getItemKey));
                
                // 추가된 일정과 삭제된 일정 식별
                const addedItems = sortedFinalItems.filter(item => !originalItemKeys.has(getItemKey(item)));
                const removedItems = originalLastDayItems.filter(item => !newItemKeys.has(getItemKey(item)));
                
                // 삭제된 일정의 비용 합산
                const removedCost = removedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                
                // 추가된 일정에 대한 비용 산정 (Google API 사용)
                let addedCost = 0;
                if (addedItems.length > 0) {
                  // cost가 0이거나 없는 추가된 일정만 비용 산정
                  const itemsToEstimate = addedItems.filter(item => !item.cost || item.cost === 0);
                  
                  if (itemsToEstimate.length > 0) {
                    try {
                      const costResponse = await fetch('/api/estimate-activity-cost', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          destination: planData.destination,
                          activities: itemsToEstimate.map(item => ({
                            place: item.place || '',
                            activity: item.activity || '',
                            notes: item.notes || '',
                          })),
                          people: 1, // 기본값 1명 사용
                        }),
                      });
                      
                      if (costResponse.ok) {
                        const costData = await costResponse.json();
                        if (costData.costs && Array.isArray(costData.costs)) {
                          // 비용 산정 결과를 일정에 반영
                          costData.costs.forEach((costInfo: any, index: number) => {
                            const itemIndex = sortedFinalItems.findIndex(item => 
                              itemsToEstimate[index] && 
                              getItemKey(item) === getItemKey(itemsToEstimate[index])
                            );
                            if (itemIndex >= 0) {
                              sortedFinalItems[itemIndex] = {
                                ...sortedFinalItems[itemIndex],
                                cost: costInfo.cost || 0,
                              };
                            }
                          });
                          
                          addedCost = costData.costs.reduce((sum: number, costInfo: any) => sum + (costInfo.cost || 0), 0);
                          console.log(`[마지막날 비용 산정] ${itemsToEstimate.length}개 일정에 대해 ${addedCost.toLocaleString()}원 산정`);
                        }
                      }
                    } catch (error) {
                      console.error('[마지막날 비용 산정] 오류:', error);
                      // 오류 발생 시 기존 cost 합산 사용
                      addedCost = addedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                    }
                  } else {
                    // 이미 cost가 있는 경우 기존 cost 사용
                    addedCost = addedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                  }
                }
                
                // 비용 차이 계산 (추가/삭제된 일정의 실제 비용 차이)
                const lastDayCostDiff = addedCost - removedCost;
                
                // 마지막날 일일 예산 계산: 항목별 cost 합계 + 현지 이동비
                const itemsCostSum = sortedFinalItems.reduce((sum, item) => sum + (item.cost || 0), 0);
                const transportCost = day.daily_transport_cost || 0;
                const finalDailyCost = itemsCostSum + transportCost;

                return {
                  ...day,
                  items: sortedFinalItems, // 각 항목의 cost는 실제 산정된 비용으로 업데이트됨
                  daily_estimated_cost: Math.round(finalDailyCost), // 일차별 예산 = 항목 cost 합 + 현지 이동비
                  _costDiff: lastDayCostDiff, // 마지막날 비용 차이 저장
                };
              }

              return day;
            })
          );

          return processedDays;
        };

        let updatedDays = await processDays();

        // 첫째날/마지막날 일정 추가/삭제 비용은 이후에 updateBudgetFromItemCosts 함수에서 자동으로 반영됨
        // (각 항목의 cost가 이미 업데이트되었으므로, 예산 분류별로 합산하여 예산 분배 항목을 업데이트하면 됨)
        
        // _costDiff 속성 제거 (임시 속성)
        updatedDays = updatedDays.map(day => {
          const { _costDiff, ...dayWithoutCostDiff } = day as any;
          return dayWithoutCostDiff;
        });

        // 항공편 시간 업데이트
        updatedPlanData = {
          ...updatedPlanData,
          arrivalTime: inputArrivalTime || updatedPlanData.arrivalTime || null,
          departureTime: inputDepartureTime || updatedPlanData.departureTime || null,
          days: updatedDays,
        };
      }

      // 3. 일차별 예산 보정: 모든 일차의 daily_estimated_cost = 항목 cost 합 + 현지 이동비
      const normalizedDays = updatedPlanData.days.map((day) => {
        const itemsCostSum = day.items.reduce((sum, item) => sum + (item.cost || 0), 0);
        const transportCost = day.daily_transport_cost || 0;
        const calculatedDailyCost = itemsCostSum + transportCost;
        
        // 일차별 예산 = 항목 cost 합 + 현지 이동비
        return {
          ...day,
          daily_estimated_cost: Math.round(calculatedDailyCost),
        };
      });

      updatedPlanData = {
        ...updatedPlanData,
        days: normalizedDays,
      };

      // 4. 각 항목의 cost를 예산 분류별로 합산하여 예산 분배 항목 업데이트
      updatedPlanData = updateBudgetFromItemCosts(updatedPlanData);

      // 5. 최종 업데이트
      setPlanData(updatedPlanData);
      
      // 입력 필드 초기화
      if (hasPriceInput) {
        setRealFlightCost('');
        setRealAccommodationCost('');
      }
      if (hasTimeInput) {
        setInputArrivalTime('');
        setInputDepartureTime('');
      }
      
      setRebalanceSuccess(true);
      setTimeout(() => setRebalanceSuccess(false), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재조정 중 오류가 발생했습니다.';
      setRebalanceError(errorMessage);
    } finally {
      setRebalancing(false);
    }
  };

  if (!planData || !planData.days || planData.days.length === 0) {
    return (
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">결과를 불러오는 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{planData.destination} 여행 계획</CardTitle>
              <CardDescription className="mt-2">
                전체 요약 및 {planData.days.length}일간의 맞춤형 여행 계획입니다.
              </CardDescription>
              {/* 도시 대표 사진 캐러셀 (AI 추정 최적 총 예산 위) */}
              {destinationImageUrls.length > 0 && (
                <div className="mt-4 rounded-lg overflow-hidden border shadow-sm relative group">
                  {/* 이미지 슬라이드 컨테이너 */}
                  <div className="relative w-full aspect-[21/9] min-h-[200px] overflow-hidden">
                    {destinationImageUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${planData.destination} 대표 이미지 ${index + 1}`}
                        className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ease-in-out ${
                          index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                        onError={(e) => {
                          // 이미지 로딩 실패 시 해당 이미지만 숨김 (배열은 유지하여 인덱스 안정성 확보)
                          const target = e.currentTarget;
                          target.style.display = 'none';
                        }}
                        loading="lazy"
                      />
                    ))}
            </div>
                  
                  {/* 좌우 화살표 버튼 */}
                  {destinationImageUrls.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-none opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        onClick={prevImage}
                        aria-label="이전 이미지"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-none opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        onClick={nextImage}
                        aria-label="다음 이미지"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                      
                      {/* 점 인디케이터 */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                        {destinationImageUrls.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToImage(index)}
                            className={`h-2 rounded-full transition-all ${
                              index === currentImageIndex
                                ? 'w-8 bg-white'
                                : 'w-2 bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`이미지 ${index + 1}로 이동`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {imageLoading && destinationImageUrls.length === 0 && (
                <div className="mt-4 rounded-lg overflow-hidden border bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 aspect-[21/9] min-h-[200px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {planData.estimated_budget && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">AI 추정 최적 총 예산</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {planData.estimated_budget.total_amount.toLocaleString()}
                    </span>
                    <span className="text-lg text-muted-foreground">{planData.estimated_budget.currency}</span>
                  </div>
            </div>
              )}
              {/* 액션 버튼들 */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSavePlan}
                  variant="outline"
                  size="sm"
                  disabled={saved}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saved ? '저장됨' : '이 계획 저장하기'}
                </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                {copied ? '복사됨!' : '전체 복사'}
              </Button>
              <Button
                  onClick={handleDownloadCSV}
                variant="outline"
                size="sm"
              >
                  <Download className="h-4 w-4 mr-2" />
                  CSV 다운로드
              </Button>
              </div>
              {saved && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  ✓ 프로필 페이지에서 저장된 계획을 확인할 수 있습니다.
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 h-auto mb-6 overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="text-xs md:text-sm px-2 md:px-3 py-2 whitespace-nowrap"
              >
                여행 요약
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="text-xs md:text-sm px-2 md:px-3 py-2 whitespace-nowrap"
              >
                여행 세부사항
              </TabsTrigger>
              {planData.days.map((dayPlan, index) => (
                <TabsTrigger
                  key={dayPlan.date}
                  value={`day-${index}`}
                  className="text-xs md:text-sm px-2 md:px-3 py-2"
                >
                  {index + 1}일차
                </TabsTrigger>
              ))}
            </TabsList>
            
            {/* 여행 요약 탭 (개요, 팁, 주의사항) */}
            <TabsContent value="overview" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">여행 요약</CardTitle>
                  <CardDescription>
                    여행지 개요, 팁, 주의사항 등 기본 정보
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {planData.summary.overview && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">여행지 개요</h3>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {planData.summary.overview}
                        </p>
                        </div>
                      </div>
                    )}
                    
                    {planData.summary.tips && planData.summary.tips.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">여행 팁</h3>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            {planData.summary.tips.map((tip, i) => (
                              <li key={i} className="leading-relaxed">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    {planData.summary.notes && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">주의사항</h3>
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {planData.summary.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 여행 세부사항 탭 (예산, 가격 비교 등) */}
            <TabsContent value="summary" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">여행 세부사항</CardTitle>
                  <CardDescription>
                    예산 정보 및 실시간 가격 비교 등 상세 정보
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* 1. 실시간 가격 비교 (외부 검색 링크) */}
                    {planData.external_links && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">1. 실시간 가격 비교</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {planData.external_links.flight_search_url && (
                            <Button
                              asChild
                              variant="outline"
                              className="w-full h-auto py-4 px-4 justify-start hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <a
                                href={planData.external_links.flight_search_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3"
                              >
                                <Plane className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 text-left">
                                  <div className="font-semibold">실시간 항공권 검색</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Skyscanner에서 비교
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                              </a>
                            </Button>
                          )}
                          {planData.external_links.accommodation_search_url && (
                            <Button
                              asChild
                              variant="outline"
                              className="w-full h-auto py-4 px-4 justify-start hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <a
                                href={(() => {
                                  const baseUrl = planData.external_links.accommodation_search_url;
                                  const people = planData.people || 1;
                                  const rooms = planData.rooms || 1;
                                  let url = baseUrl;
                                  
                                  // 인원수 업데이트
                                  if (url.includes('group_adults=')) {
                                    url = url.replace(/group_adults=\d+/, `group_adults=${people}`);
                                  } else {
                                    const separator = url.includes('?') ? '&' : '?';
                                    url = `${url}${separator}group_adults=${people}`;
                                  }
                                  
                                  // 방 개수 업데이트
                                  if (url.includes('no_rooms=')) {
                                    url = url.replace(/no_rooms=\d+/, `no_rooms=${rooms}`);
                                  } else {
                                    const separator = url.includes('?') ? '&' : '?';
                                    url = `${url}${separator}no_rooms=${rooms}`;
                                  }
                                  
                                  return url;
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3"
                              >
                                <Hotel className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 text-left">
                                  <div className="font-semibold">실시간 숙소 검색</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Booking.com에서 비교
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 2. 숙소 추천 지역 */}
                    {planData.summary.accommodation_selection_reason && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                          <h3 className="text-xl font-bold flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            2. AI 추천 숙소 위치
                          </h3>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {planData.summary.accommodation_selection_reason}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3. 실시간 가격 및 일정 반영 섹션 */}
                    {planData.estimated_budget && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">3. 실시간 가격 및 일정 반영</h3>
                        </div>
                        <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800">
                        <p className="text-sm text-muted-foreground mb-4">
                          실제로 확인한 항공권 및 숙박 가격, 항공편 시간을 입력하면 예산과 일정이 자동으로 재조정됩니다.
                        </p>
                        <div className="space-y-4">
                          {/* 항공권 및 숙박 가격 입력 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="realFlightCost">실제 항공권 가격 (원)</Label>
                              <Input
                                id="realFlightCost"
                                type="number"
                                placeholder="예: 1200000"
                                value={realFlightCost}
                                onChange={(e) => setRealFlightCost(e.target.value)}
                                disabled={rebalancing}
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="realAccommodationCost">실제 숙박 총 비용 (원)</Label>
                              <Input
                                id="realAccommodationCost"
                                type="number"
                                placeholder="예: 500000"
                                value={realAccommodationCost}
                                onChange={(e) => setRealAccommodationCost(e.target.value)}
                                disabled={rebalancing}
                                className="h-10"
                              />
                            </div>
                          </div>
                          
                          {/* 항공편 시간 입력 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="arrivalTimeInput">출국편 도착 시각 (여행지 도착 시각)</Label>
                              <Input
                                id="arrivalTimeInput"
                                type="time"
                                value={inputArrivalTime || planData.arrivalTime || ''}
                                onChange={(e) => setInputArrivalTime(e.target.value)}
                                disabled={rebalancing}
                                className="h-10"
                                placeholder="예: 14:30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="departureTimeInput">귀국편 출발 시각 (여행지 출발 시각)</Label>
                              <Input
                                id="departureTimeInput"
                                type="time"
                                value={inputDepartureTime || planData.departureTime || ''}
                                onChange={(e) => setInputDepartureTime(e.target.value)}
                                disabled={rebalancing}
                                className="h-10"
                                placeholder="예: 18:00"
                              />
                            </div>
                          </div>
                          
                          {/* 현재 반영된 항공편 시간 표시 */}
                          {(planData.arrivalTime || planData.departureTime) && (
                            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
                                현재 반영된 항공편 시간
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                {planData.arrivalTime && (
                                  <div>
                                    <div className="text-muted-foreground mb-1">출국편 도착 시각</div>
                                    <div className="font-semibold">
                                      {planData.startDate} {planData.arrivalTime}
                                    </div>
                                  </div>
                                )}
                                {planData.departureTime && (
                                  <div>
                                    <div className="text-muted-foreground mb-1">귀국편 출발 시각</div>
                                    <div className="font-semibold">
                                      {planData.endDate} {planData.departureTime}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <Button
                          onClick={handleRebalanceBudget}
                          disabled={rebalancing || (!realFlightCost && !realAccommodationCost && !inputArrivalTime && !inputDepartureTime)}
                          className="w-full mt-4"
                        >
                          {rebalancing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              재조정 중...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              예산 및 일정 재조정
                            </>
                          )}
                        </Button>
                        {rebalanceError && (
                          <div className="mt-3 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                            {rebalanceError}
                          </div>
                        )}
                        {rebalanceSuccess && (
                          <div className="mt-3 p-3 bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-md">
                            예산이 성공적으로 재조정되었습니다.
                          </div>
                        )}
                        </div>
                      </div>
                    )}

                    {/* 4. 예산 분배 */}
                    {planData.estimated_budget && (
                      <div className="border-b pb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                          <h3 className="text-xl font-bold">4. 예산 분배</h3>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(planData.estimated_budget.breakdown).map(([key, amount]) => {
                            if (amount <= 0) return null;
                            
                            const total = planData.estimated_budget.total_amount;
                            const percentage = ((amount / total) * 100).toFixed(1);
                            const labelMap: Record<string, string> = {
                              flight_cost: '왕복 항공/교통비',
                              accommodation_cost: '숙소 비용',
                              local_transport_cost: '현지 이동비',
                              food_and_drink_cost: '식비 및 음료',
                              activities_and_tours_cost: '관광 및 체험료',
                              contingency_and_misc: '예비비 및 쇼핑',
                              // 하위 호환성 (기존 필드)
                              food: '식비',
                              accommodation: '숙박',
                              transportation: '교통비',
                              activities: '관광지 및 체험',
                              misc: '기타',
                            };
                            
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium">{labelMap[key] || key}</span>
                                  <span className="text-muted-foreground">
                                    {amount.toLocaleString()}원 ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. 예산 사용 흐름 (누적 소비 그래프) */}
                    {planData.estimated_budget && planData.days.some(day => day.daily_estimated_cost) && (() => {
                      // 누적 데이터 배열 생성
                      const cumulativeData: { day: number; cumulative: number; daily: number; date: string }[] = [];
                      let runningTotal = 0;
                      
                      planData.days.forEach((day, index) => {
                        if (day.daily_estimated_cost) {
                          runningTotal += day.daily_estimated_cost;
                          cumulativeData.push({
                            day: index + 1,
                            cumulative: runningTotal,
                            daily: day.daily_estimated_cost,
                            date: day.date,
                          });
                        }
                      });

                      const maxCumulative = Math.max(...cumulativeData.map(d => d.cumulative), planData.estimated_budget.total_amount);
                      const graphHeight = 320;
                      const graphWidth = 600;
                      const padding = { top: 20, right: 40, bottom: 60, left: 60 };
                      const chartWidth = graphWidth - padding.left - padding.right;
                      const chartHeight = graphHeight - padding.top - padding.bottom;

                      // SVG 경로 생성 (꺾은선)
                      const points = cumulativeData.map((data, index) => {
                        const x = (index / (cumulativeData.length - 1 || 1)) * chartWidth + padding.left;
                        const y = chartHeight - (data.cumulative / maxCumulative) * chartHeight + padding.top;
                        return { x, y, ...data };
                      });

                      const pathD = points.length > 0
                        ? `M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`
                        : '';

                      return (
                        <div className="border-b pb-6 last:border-b-0">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-xl font-bold">5. 예산 사용 흐름</h3>
                          </div>
                          <div className="space-y-4">
                            <div className="relative w-full overflow-x-auto">
                              <svg
                                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                                className="w-full h-80 border rounded-lg bg-muted/20 p-4"
                                preserveAspectRatio="xMidYMid meet"
                              >
                                {/* 그리드 라인 */}
                                {[0, 25, 50, 75, 100].map((percent) => {
                                  const y = chartHeight - (percent / 100) * chartHeight + padding.top;
                                  return (
                                    <g key={percent}>
                                      <line
                                        x1={padding.left}
                                        y1={y}
                                        x2={graphWidth - padding.right}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeOpacity={0.1}
                                        strokeWidth={1}
                                      />
                                      <text
                                        x={padding.left - 10}
                                        y={y + 4}
                                        textAnchor="end"
                                        className="text-xs fill-muted-foreground"
                                      >
                                        {Math.round((maxCumulative * percent) / 100 / 10000)}만
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* 꺾은선 그래프 */}
                                {pathD && (
                                  <>
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke="url(#gradient)"
                                      strokeWidth={3}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <defs>
                                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                                        <stop offset="100%" stopColor="rgb(168, 85, 247)" />
                                      </linearGradient>
                                    </defs>
                                  </>
                                )}

                                {/* 데이터 포인트 및 툴팁 */}
                                {points.map((point, index) => (
                                  <g key={index} className="group">
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={4}
                                      fill="rgb(59, 130, 246)"
                                      className="transition-all group-hover:r-6"
                                    />
                                    {/* 툴팁 */}
                                    <foreignObject
                                      x={point.x - 60}
                                      y={point.y - 50}
                                      width="120"
                                      height="40"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    >
                                      <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                        {point.day}일차: {point.daily.toLocaleString()}원
                                        <br />
                                        누적: {point.cumulative.toLocaleString()}원
                                      </div>
                                    </foreignObject>
                                  </g>
                                ))}

                                {/* X축 라벨 */}
                                {points.map((point, index) => (
                                  <text
                                    key={index}
                                    x={point.x}
                                    y={graphHeight - padding.bottom + 20}
                                    textAnchor="middle"
                                    className="text-xs fill-muted-foreground"
                                  >
                                    {point.day}일
                                  </text>
                                ))}
                              </svg>
                            </div>
                            {/* 범례 */}
                            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                                <span>누적 소비액</span>
                              </div>
                            </div>
                            
                            {/* 요약 정보 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-6">
                              <div>
                                <div className="text-xs text-muted-foreground">일평균 지출</div>
                                <div className="font-semibold">
                                  {(
                                    planData.days
                                      .filter(day => day.daily_estimated_cost)
                                      .reduce((sum, day) => sum + (day.daily_estimated_cost || 0), 0) /
                                    planData.days.filter(day => day.daily_estimated_cost).length
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">최대 일일 지출</div>
                                <div className="font-semibold">
                                  {Math.max(
                                    ...planData.days.map(day => day.daily_estimated_cost || 0)
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">최소 일일 지출</div>
                                <div className="font-semibold">
                                  {Math.min(
                                    ...planData.days
                                      .filter(day => day.daily_estimated_cost)
                                      .map(day => day.daily_estimated_cost || 0)
                                  ).toLocaleString()}원
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">총 예상 비용</div>
                                <div className="font-semibold">
                                  {planData.estimated_budget.total_amount.toLocaleString()}원
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* 기존 예산 정보 (하위 호환성을 위해 유지) */}
                    {!planData.estimated_budget && planData.summary.budget && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2">예산 분배</h3>
                        <div className="space-y-2">
                          {planData.summary.budget.accommodation && (
                            <div className="flex justify-between">
                              <span>숙박</span>
                              <span>{planData.summary.budget.accommodation.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.food && (
                            <div className="flex justify-between">
                              <span>식비</span>
                              <span>{planData.summary.budget.food.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.transportation && (
                            <div className="flex justify-between">
                              <span>교통비</span>
                              <span>{planData.summary.budget.transportation.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.attractions && (
                            <div className="flex justify-between">
                              <span>관광지</span>
                              <span>{planData.summary.budget.attractions.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.other && (
                            <div className="flex justify-between">
                              <span>기타</span>
                              <span>{planData.summary.budget.other.toLocaleString()}원</span>
                            </div>
                          )}
                          {planData.summary.budget.total && (
                            <div className="flex justify-between font-semibold pt-2 border-t">
                              <span>총 예산</span>
                              <span>{planData.summary.budget.total.toLocaleString()}원</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {planData.days.map((dayPlan, index) => {
              const dateLabel = format(parseISO(dayPlan.date), 'yyyy년 MM월 dd일 (E)', { locale: ko });
              return (
                <TabsContent
                  key={dayPlan.date}
                  value={`day-${index}`}
                  className="mt-0"
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                      <CardTitle className="text-xl">{dateLabel}</CardTitle>
                      <CardDescription>
                        {dayPlan.title || `${index + 1}일차 여행 계획`}
                      </CardDescription>
                        </div>
                        {dayPlan.daily_estimated_cost !== undefined && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground">당일 예상 지출</span>
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              {dayPlan.daily_estimated_cost.toLocaleString()}원
                            </span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {dayPlan.summary && (
                        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">{dayPlan.summary}</p>
                        </div>
                      )}

                      {/* 일차별 Google 지도 길 찾기 버튼 및 현지 이동비 표시 */}
                      {(() => {
                        const totalDays = planData.days.length;
                        const directionsUrl = getDayDirectionsUrl(dayPlan, index, totalDays);
                        const transportCost = dayPlan.daily_transport_cost || 0;
                        return (
                          <div className="mb-4 flex items-center justify-end gap-3">
                            {transportCost > 0 && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">현지 이동비: </span>
                                <span className="text-foreground">{transportCost.toLocaleString()}원</span>
                              </div>
                            )}
                            {directionsUrl && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs md:text-sm"
                              >
                                <a
                                  href={directionsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5"
                                >
                                  <Navigation className="h-3.5 w-3.5" />
                                  <span>Google 지도 길 찾기</span>
                                </a>
                              </Button>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-4">
                        {dayPlan.items.map((item, itemIndex) => {
                          const itemKey = `${index}-${itemIndex}`;
                          const itemImage = itemImages[itemKey];
                          
                          // 공항 도착/출발 식별 함수 (이들은 사진/예약 버튼 표시하지 않음)
                          const isAirportArrivalOrDeparture = (item: DayItem): boolean => {
                            const airportArrivalKeywords = ['공항 도착', 'airport arrival', '공항 도착지', '도착지 공항'];
                            const airportDepartureKeywords = ['공항 출발', 'airport departure', '공항 출발지', '출발지 공항', '탑승'];
                            const place = (item.place || '').toLowerCase();
                            const activity = (item.activity || '').toLowerCase();
                            
                            if (airportArrivalKeywords.some(keyword => 
                              place.includes(keyword.toLowerCase()) || 
                              activity.includes(keyword.toLowerCase())
                            )) {
                              return true;
                            }
                            
                            if (airportDepartureKeywords.some(keyword => 
                              place.includes(keyword.toLowerCase()) || 
                              activity.includes(keyword.toLowerCase())
                            )) {
                              return true;
                            }
                            
                            return false;
                          };
                          
                          // 공항으로 이동하는 일정 (표시는 하되 사진/예약 링크만 제거)
                          const isAirportMovement = (item: DayItem): boolean => {
                            const airportMovementKeywords = ['공항으로', '공항으로 이동', 'airport'];
                            const place = (item.place || '').toLowerCase();
                            const activity = (item.activity || '').toLowerCase();
                            
                            if (!isAirportArrivalOrDeparture(item)) {
                              return airportMovementKeywords.some(keyword => 
                                (place.includes(keyword.toLowerCase()) && !place.includes('도착') && !place.includes('출발')) || 
                                (activity.includes(keyword.toLowerCase()) && !activity.includes('도착') && !activity.includes('출발'))
                              );
                            }
                            
                            return false;
                          };
                          
                          const isAirport = isAirportArrivalOrDeparture(item) || isAirportMovement(item);
                          const isSimpleMeal = isSimpleMealActivity(item);
                          const hasImage = !isAirport && !isSimpleMeal && item.image_search_link && item.image_search_link.trim() !== '';
                          const hasReservation = !isAirport && item.official_website_link?.trim() && item.purchase_search_link?.trim();
                          
                          return (
                            <div key={itemIndex} className={`border-l-4 border-primary pl-4 ${hasImage ? 'py-2' : 'py-1'}`}>
                            <div className="flex items-start gap-3">
                              <span className="font-semibold text-primary min-w-[60px]">
                                {item.time}
                              </span>
                                <div className={`flex-1 ${hasImage ? 'flex gap-4' : ''}`}>
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-medium">{item.place}</div>
                                <div className="text-muted-foreground mt-1">{item.activity}</div>
                                      </div>
                                      {item.cost !== undefined && item.cost > 0 && (
                                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                            {item.cost.toLocaleString()}원
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            ({getBudgetCategoryForItem(item)})
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  {item.next_move_duration && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Navigation className="h-3.5 w-3.5 flex-shrink-0" />
                                      <span>다음 이동 예상 시간: {item.next_move_duration}</span>
                                    </div>
                                  )}
                                  {/* 지도 보기, 공식 정보, 티켓 검색 버튼 (일렬 배열) - 공항 관련 일정 제외 */}
                                  {!isAirport && (hasImage || hasReservation) && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {/* 지도 보기 버튼 */}
                                      {item.image_search_link && item.image_search_link.trim() !== '' && (() => {
                                        // item.activity, item.place, destination을 사용하여 Google Maps 검색 URL 생성
                                        let searchUrl: string | null = null;
                                        
                                        try {
                                          // 검색어 구성: 장소명이 있으면 장소명 우선, 없으면 활동명 사용
                                          const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                                          // 구글 지도 검색어: 장소명 + 목적지
                                          const searchKeyword = `${placeOrActivity} ${planData.destination}`.trim();
                                          
                                          // 검색어가 비어있지 않은 경우에만 URL 생성
                                          if (searchKeyword && searchKeyword.length > 0) {
                                            // Google Maps 검색 URL 생성
                                            const encodedQuery = encodeURIComponent(searchKeyword);
                                            searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
                                          }
                                        } catch (error) {
                                          console.warn('[지도 검색 URL 생성 오류]', error);
                                          searchUrl = null;
                                        }

                                        return searchUrl ? (
                                          <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                          >
                                            <a
                                              href={searchUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1.5"
                                            >
                                              <MapPin className="h-3.5 w-3.5" />
                                              <span>지도 보기</span>
                                            </a>
                                          </Button>
                                        ) : null;
                                      })()}
                                      {/* 공식 정보 및 티켓 검색 버튼 (두 필드가 모두 있을 때만 표시) */}
                                      {item.official_website_link && item.official_website_link.trim() !== '' && item.purchase_search_link && item.purchase_search_link.trim() !== '' && (
                                        <>
                                          {/* 공식 정보 버튼 */}
                                          {(() => {
                                            // URL 정제 및 유효성 검증
                                            let safeUrl: string | null = null;
                                            try {
                                              const cleanedUrl = item.official_website_link!.trim();
                                              const url = new URL(cleanedUrl);
                                              if (url.protocol === 'http:' || url.protocol === 'https:') {
                                                safeUrl = cleanedUrl;
                                              }
                                            } catch {
                                              safeUrl = null;
                                            }

                                            return safeUrl ? (
                                              <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                              >
                                                <a
                                                  href={safeUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1.5"
                                                >
                                                  <Globe className="h-3.5 w-3.5" />
                                                  <span>공식 정보</span>
                                                </a>
                                              </Button>
                                            ) : null;
                                          })()}
                                          {/* 티켓 검색 버튼 */}
                                          {(() => {
                                            // URL 정제 및 유효성 검증
                                            let safeUrl: string | null = null;
                                            try {
                                              const cleanedUrl = item.purchase_search_link!.trim();
                                              const url = new URL(cleanedUrl);
                                              if (url.protocol === 'http:' || url.protocol === 'https:') {
                                                safeUrl = cleanedUrl;
                                              }
                                            } catch {
                                              safeUrl = null;
                                            }

                                            return safeUrl ? (
                                              <Button
                                                asChild
                                                variant="default"
                                                size="sm"
                                                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                              >
                                                <a
                                                  href={safeUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1.5"
                                                >
                                                  <ShoppingCart className="h-3.5 w-3.5" />
                                                  <span>티켓 검색</span>
                                                </a>
                                              </Button>
                                            ) : null;
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  )}
                                {item.notes && (
                                  <div className="text-sm text-muted-foreground mt-1 italic">
                                    💡 {item.notes}
                                  </div>
                                )}
                              </div>
                                  {/* 명소 이미지 표시 - 오른쪽 고정 열 (image_search_link가 있을 때만 표시) */}
                                  {hasImage && (
                                    <div className="flex-shrink-0 w-72">
                                      {itemImage?.loading && (
                                        <div className="w-72 h-48 rounded-md bg-muted flex items-center justify-center">
                                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                                      )}
                                      {!itemImage?.loading && itemImage?.url && (
                                        <img
                                          src={itemImage.url}
                                          alt={`${item.place || item.activity} 이미지`}
                                          className="w-72 h-48 object-contain rounded-md border shadow-sm bg-muted/50 cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => {
                                            setEnlargedImageUrl(itemImage.url);
                                            setEnlargedImageAlt(`${item.place || item.activity} 이미지`);
                                          }}
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                          loading="lazy"
                                        />
                                      )}
                                      {!itemImage?.loading && !itemImage?.url && (
                                        <div className="w-72 h-48 rounded-md bg-muted flex items-center justify-center">
                                          <Image className="h-8 w-8 text-muted-foreground" />
                          </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
      
      {/* 이미지 확대 모달 */}
      {enlargedImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0"
          onClick={() => {
            setEnlargedImageUrl(null);
            setEnlargedImageAlt('');
          }}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => {
                setEnlargedImageUrl(null);
                setEnlargedImageAlt('');
              }}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/50 hover:bg-black/70 text-white p-2 transition-colors"
              aria-label="닫기"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={enlargedImageUrl}
              alt={enlargedImageAlt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanResultPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-8 max-w-4xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">결과를 불러오는 중...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PlanResultContent />
    </Suspense>
  );
}

