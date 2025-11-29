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
}

interface DayPlan {
  date: string;
  title: string;
  summary: string;
  daily_estimated_cost?: number;
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
  destination_image_query?: string;
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
      
      // 비사진 키워드 제외 (무조건 건너뛰기)
      const excludedKeywords = ['map', 'logo', 'diagram', 'sketch', 'plan', 'icon', 'symbol', 'chart', 'graph', 'drawing', 'illustration'];
      if (excludedKeywords.some(keyword => lowerFileName.includes(keyword))) {
        return false;
      }
      
      // 사진 확장자 확인
      const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      return photoExtensions.some(ext => lowerFileName.endsWith(ext));
    };
    
    // 파일 확장자 우선순위 점수 계산 (높을수록 우선)
    const getFilePriorityScore = (fileName: string): number => {
      const lowerFileName = fileName.toLowerCase();
      
      // 최우선 확장자: .jpg, .jpeg, .png
      if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) {
        return 3;
      }
      if (lowerFileName.endsWith('.png')) {
        return 2;
      }
      // 차순위 확장자: .webp, .gif
      if (lowerFileName.endsWith('.webp') || lowerFileName.endsWith('.gif')) {
        return 1;
      }
      
      return 0;
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
        
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });
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
            
            const imageResponse = await fetch(imageInfoUrl, {
              headers: {
                'Accept': 'application/json',
              },
            });
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
        console.error(`[이미지 검색] 오류 for "${searchTerm}":`, error);
        return null;
      }
    };
    
    // 검색어 정리 및 변형
    const cleanQuery = query.trim();
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
    
    // 다양한 검색어 조합 시도
    const searchVariations = [
      cleanQuery, // 원본
      ...queryWords.slice(0, 3).map(w => w), // 주요 단어만
      `${cleanQuery} photograph`,
      `${cleanQuery} photo`,
      `${cleanQuery} view`,
      `${cleanQuery} exterior`,
      `${cleanQuery} landmark`,
      `${cleanQuery} famous`,
      `${cleanQuery} building`,
      `${cleanQuery} architecture`,
      queryWords.length > 1 ? queryWords[0] : cleanQuery, // 첫 번째 단어만
      queryWords.length > 1 ? queryWords.join(' ') : cleanQuery, // 공백으로 연결
    ];
    
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
    
    // 내부 헬퍼 함수: 실제 이미지 검색 및 URL 배열 가져오기
    const searchImages = async (searchTerm: string): Promise<string[]> => {
      try {
        // 1단계: 파일 검색 (최대 5개)
        const encodedQuery = encodeURIComponent(searchTerm);
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srnamespace=6&srlimit=5&format=json&origin=*`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) return [];
        
        const searchData = await searchResponse.json();
        const searchResults = searchData.query?.search;
        
        if (!searchResults || searchResults.length === 0) return [];
        
        // 여러 검색 결과에서 이미지 파일 URL 배열 수집
        const imageUrls: string[] = [];
        
        for (const result of searchResults) {
          const fileName = result.title.replace('File:', '');
          
          // 2단계: 실제 이미지 파일 URL 요청
          const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
          
          const imageResponse = await fetch(imageInfoUrl);
          if (!imageResponse.ok) continue;
          
          const imageData = await imageResponse.json();
          const pages = imageData.query?.pages;
          
          if (!pages) continue;
          
          // 이미지 URL 추출
          const pageId = Object.keys(pages)[0];
          const imageInfo = pages[pageId]?.imageinfo;
          
          if (imageInfo && imageInfo.length > 0 && imageInfo[0].url) {
            imageUrls.push(imageInfo[0].url);
          }
          
          // 최대 5개까지만 수집
          if (imageUrls.length >= 5) break;
        }
        
        return imageUrls;
      } catch (error) {
        console.error('Wikimedia 이미지 검색 오류:', error);
        return [];
      }
    };
    
    // 먼저 원본 쿼리로 검색 시도
    let imageUrls = await searchImages(query);
    
    // 원본 쿼리에 전경 키워드가 없으면 추가하여 재시도 (도시 전경 우선)
    const queryLower = query.toLowerCase();
    const hasSkyline = queryLower.includes('skyline');
    const hasCityscape = queryLower.includes('cityscape');
    const hasCityView = queryLower.includes('city view');
    
    // 전경 키워드가 없고 이미지가 부족하면 추가 (도시 전경 우선)
    if (imageUrls.length < 5 && !hasSkyline && !hasCityscape && !hasCityView) {
      const skylineUrls = await searchImages(`${query} skyline`);
      const cityscapeUrls = await searchImages(`${query} cityscape`);
      const cityViewUrls = await searchImages(`${query} city view`);
      
      // 중복 제거하며 배열 병합
      const allUrls = [...new Set([...imageUrls, ...skylineUrls, ...cityscapeUrls, ...cityViewUrls])];
      imageUrls = allUrls.slice(0, 5);
    }
    
    // 검색 결과가 부족하고 쿼리에 공백이 있으면, 도시 이름만 추출하여 전경으로 재시도
    if (imageUrls.length < 5 && query.includes(' ')) {
      const words = query.split(' ');
      const cityName = words[0]; // 첫 번째 단어 (도시 이름)
      
      const skylineUrls = await searchImages(`${cityName} skyline`);
      const cityscapeUrls = await searchImages(`${cityName} cityscape`);
      const cityViewUrls = await searchImages(`${cityName} city view`);
      
      // 중복 제거하며 배열 병합
      const allUrls = [...new Set([...imageUrls, ...skylineUrls, ...cityscapeUrls, ...cityViewUrls])];
      imageUrls = allUrls.slice(0, 5);
    }
    
    return imageUrls;
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
        const shouldLoadImage = item.image_search_link && item.image_search_link.trim() !== '';
        
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
          
          if (imageQuery) {
            // 이미지 로드 (재시도 로직 포함)
            const loadImageWithRetry = async (query: string, retryCount: number = 0): Promise<void> => {
              try {
                const url = await fetchWikimediaImageForActivity(query);
                
                if (url) {
                  // 이미지 URL 유효성 검증 (실제 로드 가능한지 확인)
                  const img = new window.Image();
                  img.onload = () => {
                    setItemImages(prev => ({
                      ...prev,
                      [itemKey]: { url, loading: false }
                    }));
                  };
                  img.onerror = () => {
                    // 이미지 로드 실패 시 재시도
                    if (retryCount < 2) {
                      // 대체 검색어로 재시도
                      const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                      const destination = planData.destination || '';
                      
                      const alternativeQueries = [
                        `${placeOrActivity} ${destination}`,
                        placeOrActivity,
                        `${item.activity} ${destination}`,
                        item.activity,
                      ].filter(q => q.trim() !== '' && q !== query);
                      
                      if (alternativeQueries.length > retryCount) {
                        setTimeout(() => {
                          loadImageWithRetry(alternativeQueries[retryCount], retryCount + 1);
                        }, 500);
                      } else {
                        setItemImages(prev => ({
                          ...prev,
                          [itemKey]: { url: null, loading: false }
                        }));
                      }
                    } else {
                      setItemImages(prev => ({
                        ...prev,
                        [itemKey]: { url: null, loading: false }
                      }));
                    }
                  };
                  
                  // 타임아웃 설정 (10초)
                  setTimeout(() => {
                    if (!img.complete) {
                      img.onerror = null;
                      if (retryCount < 2) {
                        const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                        const destination = planData.destination || '';
                        const alternativeQueries = [
                          `${placeOrActivity} ${destination}`,
                          placeOrActivity,
                        ].filter(q => q.trim() !== '' && q !== query);
                        
                        if (alternativeQueries.length > retryCount) {
                          loadImageWithRetry(alternativeQueries[retryCount], retryCount + 1);
                        } else {
                          setItemImages(prev => ({
                            ...prev,
                            [itemKey]: { url: null, loading: false }
                          }));
                        }
                      } else {
                        setItemImages(prev => ({
                          ...prev,
                          [itemKey]: { url: null, loading: false }
                        }));
                      }
                    }
                  }, 10000);
                  
                  img.src = url;
                } else {
                  // URL을 찾지 못한 경우 재시도
                  if (retryCount < 2) {
                    const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                    const destination = planData.destination || '';
                    
                    const alternativeQueries = [
                      `${placeOrActivity} ${destination}`,
                      placeOrActivity,
                      `${item.activity} ${destination}`,
                      item.activity,
                    ].filter(q => q.trim() !== '' && q !== query);
                    
                    if (alternativeQueries.length > retryCount) {
                      setTimeout(() => {
                        loadImageWithRetry(alternativeQueries[retryCount], retryCount + 1);
                      }, 500);
                    } else {
                      setItemImages(prev => ({
                        ...prev,
                        [itemKey]: { url: null, loading: false }
                      }));
                    }
                  } else {
                    setItemImages(prev => ({
                      ...prev,
                      [itemKey]: { url: null, loading: false }
                    }));
                  }
                }
              } catch (error) {
                console.error(`활동 이미지 로드 실패 (${itemKey}, 시도 ${retryCount + 1}):`, error);
                
                // 재시도
                if (retryCount < 2) {
                  const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                  const destination = planData.destination || '';
                  
                  const alternativeQueries = [
                    `${placeOrActivity} ${destination}`,
                    placeOrActivity,
                    `${item.activity} ${destination}`,
                    item.activity,
                  ].filter(q => q.trim() !== '' && q !== query);
                  
                  if (alternativeQueries.length > retryCount) {
                    setTimeout(() => {
                      loadImageWithRetry(alternativeQueries[retryCount], retryCount + 1);
                    }, 1000);
                  } else {
                    setItemImages(prev => ({
                      ...prev,
                      [itemKey]: { url: null, loading: false }
                    }));
                  }
                } else {
                  setItemImages(prev => ({
                    ...prev,
                    [itemKey]: { url: null, loading: false }
                  }));
                }
              }
            };
            
            loadImageWithRetry(imageQuery);
          } else {
            // 검색어가 없으면 로딩 완료 처리
            setItemImages(prev => ({
              ...prev,
              [itemKey]: { url: null, loading: false }
            }));
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
          const data: PlanData = JSON.parse(savedData);
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
            
            // 일차별 총 비용 비율 계산 (항공권/숙박 제외한 나머지 비용 기준)
            // 항공권과 숙박 비용을 제외한 나머지 비용의 비율을 계산
            let costDiffRatio = 1;
            if (originalDailyCost > 0) {
              // 원본 일일 비용에서 항공권/숙박 비용 제외
              let originalLocalCost = originalDailyCost;
              if (index === 0 && originalFlightCost > 0) {
                originalLocalCost -= (originalFlightCost / totalDays); // 항공권 비용의 일일 배분 제외
              }
              if (index < totalDays - 1 && originalAccommodationCost > 0) {
                originalLocalCost -= (originalAccommodationCost / (totalDays - 1));
              }
              
              // 업데이트된 일일 비용에서 항공권/숙박 비용 제외
              let updatedLocalCost = updatedDailyCost;
              if (index === 0 && newFlightCost > 0) {
                updatedLocalCost -= (newFlightCost / totalDays);
              }
              if (index < totalDays - 1 && newAccommodationCost > 0) {
                updatedLocalCost -= (newAccommodationCost / (totalDays - 1));
              }
              
              // 나머지 비용의 비율 계산
              if (originalLocalCost > 0) {
                costDiffRatio = updatedLocalCost / originalLocalCost;
              }
            }
            
            // 각 항목의 cost도 비율에 맞춰 업데이트
            const updatedItems = day.items.map((item) => {
              if (item.cost !== undefined && item.cost > 0) {
                return {
                  ...item,
                  cost: Math.max(0, Math.round(item.cost * costDiffRatio)),
                };
              }
              return item;
            });
            
            // 일일 총 비용과 항목별 비용 합계가 일치하도록 조정
            const itemsCostSum = updatedItems.reduce((sum, item) => sum + (item.cost || 0), 0);
            if (itemsCostSum > 0 && Math.abs(itemsCostSum - updatedDailyCost) > 10) {
              // 차이를 비용이 있는 항목들에 비례적으로 분배
              const costItems = updatedItems.filter(item => (item.cost || 0) > 0);
              if (costItems.length > 0) {
                const adjustment = updatedDailyCost - itemsCostSum;
                costItems.forEach((item, itemIndex) => {
                  const ratio = item.cost! / itemsCostSum;
                  const itemAdjustment = adjustment * ratio;
                  const itemIndexInAll = updatedItems.findIndex(i => i === item);
                  if (itemIndexInAll >= 0) {
                    updatedItems[itemIndexInAll] = {
                      ...updatedItems[itemIndexInAll],
                      cost: Math.max(0, Math.round((item.cost || 0) + itemAdjustment)),
                    };
                  }
                });
              }
            }
            
            return {
              ...day,
              daily_estimated_cost: Math.round(updatedDailyCost),
              items: updatedItems,
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
        const updatedDays = updatedPlanData.days.map((day) => {
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
            
            // 첫날 일정 중 도착 시각 이전의 항목 제거 또는 시간 조정
            // 공항 도착/출발 항목만 제거, 공항으로 이동은 포함
            const updatedItems = day.items
              .filter((item) => {
                // 공항 도착/출발 관련 항목만 제거
                if (isAirportArrivalOrDeparture(item)) {
                  return false;
                }
                
                // 도착 시각 이전의 항목 제거
                const [itemHour, itemMin] = item.time.split(':').map(Number);
                const itemTimeInMinutes = itemHour * 60 + itemMin;
                const arrivalTimeInMinutes = arrivalHour * 60 + arrivalMin;
                return itemTimeInMinutes >= arrivalTimeInMinutes + 60;
              })
              .map((item, itemIndex) => {
                if (itemIndex === 0) {
                  // 첫 번째 항목의 시간을 도착 시각 이후로 설정
                  const [itemHour, itemMin] = item.time.split(':').map(Number);
                  const itemTimeInMinutes = itemHour * 60 + itemMin;
                  const arrivalTimeInMinutes = arrivalHour * 60 + arrivalMin;
                  
                  if (itemTimeInMinutes < arrivalTimeInMinutes + 60) {
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

            return {
              ...day,
              items: updatedItems,
            };
          }

          if (isLastDay && inputDepartureTime) {
            // 마지막 날: 출발 시각 이전으로 일정 종료
            const departureHour = parseInt(inputDepartureTime.split(':')[0]);
            const departureMin = parseInt(inputDepartureTime.split(':')[1]);
            
            // 마지막 활동 장소에서 공항까지 이동 시간 고려 (기본 2시간)
            const lastActivityHour = departureHour - 2;
            const lastActivityTime = `${lastActivityHour.toString().padStart(2, '0')}:${departureMin.toString().padStart(2, '0')}`;
            
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
            
            // 마지막 날 일정 중 출발 시각 이후의 항목 제거
            // 공항 도착/출발 항목만 제거, 공항으로 이동은 포함
            const updatedItems = day.items
              .filter((item) => {
                // 공항 도착/출발 관련 항목만 제거
                if (isAirportArrivalOrDeparture(item)) {
                  return false;
                }
                
                // 출발 시각 이후의 항목 제거
                const [itemHour, itemMin] = item.time.split(':').map(Number);
                const itemTimeInMinutes = itemHour * 60 + itemMin;
                const departureTimeInMinutes = departureHour * 60 + departureMin;
                
                return itemTimeInMinutes <= departureTimeInMinutes - 120; // 출발 시각 2시간 전까지
              })
              .map((item) => {
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

            // 마지막 항목의 시간이 출발 시각 이전이 되도록 조정
            if (updatedItems.length > 0) {
              const lastItem = updatedItems[updatedItems.length - 1];
              const [lastItemHour, lastItemMin] = lastItem.time.split(':').map(Number);
              const lastItemTimeInMinutes = lastItemHour * 60 + lastItemMin;
              const lastActivityTimeInMinutes = lastActivityHour * 60 + departureMin;
              
              if (lastItemTimeInMinutes > lastActivityTimeInMinutes) {
                updatedItems[updatedItems.length - 1] = {
                  ...lastItem,
                  time: lastActivityTime,
                };
              }
            }

            return {
              ...day,
              items: updatedItems,
            };
          }

          return day;
        });

        // 항공편 시간 업데이트
        updatedPlanData = {
          ...updatedPlanData,
          arrivalTime: inputArrivalTime || updatedPlanData.arrivalTime || null,
          departureTime: inputDepartureTime || updatedPlanData.departureTime || null,
          days: updatedDays,
        };
      }

      // 3. 최종 업데이트
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
                                href={planData.external_links.accommodation_search_url}
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
                              local_transport_cost: '현지 이동 비용',
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
                          const hasImage = !isAirport && item.image_search_link && item.image_search_link.trim() !== '';
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
                                        <div className="flex-shrink-0">
                                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                            {item.cost.toLocaleString()}원
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
                                  {/* 사진 보기, 공식 정보, 티켓 검색 버튼 (일렬 배열) - 공항 관련 일정 제외 */}
                                  {!isAirport && (hasImage || hasReservation) && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {/* 사진 보기 버튼 */}
                                      {item.image_search_link && item.image_search_link.trim() !== '' && (() => {
                                        // item.activity, item.place, destination을 사용하여 Google 이미지 검색 URL 직접 생성
                                        let searchUrl: string | null = null;
                                        
                                        try {
                                          // 검색어 구성: 장소명이 있으면 장소명 우선, 없으면 활동명 사용
                                          const placeOrActivity = (item.place && item.place.trim() !== '' ? item.place : item.activity) || '';
                                          const searchKeyword = `${placeOrActivity} ${planData.destination} 여행`.trim();
                                          
                                          // 검색어가 비어있지 않은 경우에만 URL 생성
                                          if (searchKeyword && searchKeyword.length > 0) {
                                            // Google 이미지 검색 URL 생성
                                            // 검색어를 encodeURIComponent로 인코딩하여 정확한 검색 보장
                                            const encodedKeyword = encodeURIComponent(searchKeyword);
                                            searchUrl = `https://www.google.com/search?q=${encodedKeyword}&tbm=isch`;
                                          }
                                        } catch (error) {
                                          // 오류 발생 시 기존 image_search_link 사용 시도
                                          try {
                                            const cleanedUrl = item.image_search_link!.trim();
                                            const url = new URL(cleanedUrl);
                                            if (url.protocol === 'http:' || url.protocol === 'https:') {
                                              searchUrl = cleanedUrl;
                                            }
                                          } catch {
                                            searchUrl = null;
                                          }
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
                                              <Image className="h-3.5 w-3.5" />
                                              <span>사진 보기</span>
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

