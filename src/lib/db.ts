// 메모리 기반 데이터베이스 (in-memory database)
// 개발 및 프로토타입 단계용

type User = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

type Plan = {
  id: number;
  user_id: number;
  destination: string;
  start_date: string;
  end_date: string;
  duration: number;
  budget: number;
  travelers: number;
  preferences: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ScheduleItem = {
  id: number;
  plan_id: number;
  date: string;
  time: string | null;
  place_name: string;
  place_type: string | null;
  address: string | null;
  budget: number | null;
  notes: string | null;
  order_index: number;
};

type BudgetAllocation = {
  id: number;
  plan_id: number;
  category: string;
  allocated_amount: number;
  spent_amount: number;
};

type Recommendation = {
  id: number;
  destination: string;
  place_name: string;
  category: string;
  address: string;
  price_range: string;
  rating: number;
  description: string;
  image_url: string;
  created_at: string;
};

// 메모리 데이터 저장소 (서버 재시작 시 초기화됨)
let users: User[] = [];
let plans: Plan[] = [];
let scheduleItems: ScheduleItem[] = [];
let budgetAllocations: BudgetAllocation[] = [];
let recommendations: Recommendation[] = [];

let userIdCounter = 1;
let planIdCounter = 1;
let scheduleItemIdCounter = 1;
let budgetAllocationIdCounter = 1;
let recommendationIdCounter = 1;

// 데이터베이스 초기화 함수
export function initDatabase() {
  // 이미 초기화된 경우 스킵
  if (users.length > 0) return;

  // 예시 사용자
  users = [
    {
      id: userIdCounter++,
      email: 'demo@tripgenie.com',
      name: 'Demo User',
      created_at: new Date().toISOString(),
    },
  ];

  // 예시 여행 계획
  plans = [
    {
      id: planIdCounter++,
      user_id: 1,
      destination: '제주도',
      start_date: '2024-12-20',
      end_date: '2024-12-22',
      duration: 3,
      budget: 500000,
      travelers: 2,
      preferences: JSON.stringify({ photospot: true, food: true }),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // 예시 일정
  scheduleItems = [
    {
      id: scheduleItemIdCounter++,
      plan_id: 1,
      date: '2024-12-20',
      time: '09:00',
      place_name: '성산일출봉',
      place_type: 'attraction',
      address: null,
      budget: null,
      notes: null,
      order_index: 1,
    },
    {
      id: scheduleItemIdCounter++,
      plan_id: 1,
      date: '2024-12-20',
      time: '12:00',
      place_name: '흑돼지 맛집',
      place_type: 'restaurant',
      address: null,
      budget: null,
      notes: null,
      order_index: 2,
    },
    {
      id: scheduleItemIdCounter++,
      plan_id: 1,
      date: '2024-12-20',
      time: '15:00',
      place_name: '카멜리아힐',
      place_type: 'photospot',
      address: null,
      budget: null,
      notes: null,
      order_index: 3,
    },
    {
      id: scheduleItemIdCounter++,
      plan_id: 1,
      date: '2024-12-21',
      time: '10:00',
      place_name: '협재해수욕장',
      place_type: 'beach',
      address: null,
      budget: null,
      notes: null,
      order_index: 1,
    },
    {
      id: scheduleItemIdCounter++,
      plan_id: 1,
      date: '2024-12-21',
      time: '14:00',
      place_name: '카페 루나',
      place_type: 'cafe',
      address: null,
      budget: null,
      notes: null,
      order_index: 2,
    },
  ];

  // 예시 예산 배분
  budgetAllocations = [
    {
      id: budgetAllocationIdCounter++,
      plan_id: 1,
      category: 'accommodation',
      allocated_amount: 200000,
      spent_amount: 0,
    },
    {
      id: budgetAllocationIdCounter++,
      plan_id: 1,
      category: 'food',
      allocated_amount: 150000,
      spent_amount: 0,
    },
    {
      id: budgetAllocationIdCounter++,
      plan_id: 1,
      category: 'transportation',
      allocated_amount: 100000,
      spent_amount: 0,
    },
    {
      id: budgetAllocationIdCounter++,
      plan_id: 1,
      category: 'attractions',
      allocated_amount: 50000,
      spent_amount: 0,
    },
  ];

  // 예시 추천 장소
  recommendations = [
    {
      id: recommendationIdCounter++,
      destination: '제주도',
      place_name: '성산일출봉',
      category: 'attraction',
      address: '제주특별자치도 서귀포시 성산읍',
      price_range: '5000원',
      rating: 4.5,
      description: '일출 명소로 유명한 화산체',
      image_url: 'https://picsum.photos/400/300?random=1',
      created_at: new Date().toISOString(),
    },
    {
      id: recommendationIdCounter++,
      destination: '제주도',
      place_name: '카멜리아힐',
      category: 'photospot',
      address: '제주특별자치도 서귀포시 안덕면',
      price_range: '10000원',
      rating: 4.7,
      description: '사진 찍기 좋은 카멜리아 정원',
      image_url: 'https://picsum.photos/400/300?random=2',
      created_at: new Date().toISOString(),
    },
    {
      id: recommendationIdCounter++,
      destination: '제주도',
      place_name: '협재해수욕장',
      category: 'beach',
      address: '제주특별자치도 제주시 한림읍',
      price_range: '무료',
      rating: 4.8,
      description: '맑은 바다와 하얀 모래사장',
      image_url: 'https://picsum.photos/400/300?random=3',
      created_at: new Date().toISOString(),
    },
    {
      id: recommendationIdCounter++,
      destination: '제주도',
      place_name: '흑돼지 맛집',
      category: 'food',
      address: '제주특별자치도 제주시',
      price_range: '30000원',
      rating: 4.6,
      description: '제주도 특산품 흑돼지 전문점',
      image_url: 'https://picsum.photos/400/300?random=4',
      created_at: new Date().toISOString(),
    },
  ];
}

// 데이터베이스 초기화 확인
let initialized = false;

export function ensureDatabaseInitialized() {
  if (typeof window === 'undefined' && !initialized) {
    try {
      initDatabase();
      initialized = true;
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }
}

// 서버 사이드에서 자동 초기화
if (typeof window === 'undefined') {
  ensureDatabaseInitialized();
}

// 데이터베이스 인터페이스 (SQLite와 유사한 API 제공)
const db = {
  prepare: (query: string) => {
    ensureDatabaseInitialized();

    return {
      get: (...args: any[]) => {
        // SELECT 쿼리 파싱 (간단한 구현)
        if (query.includes('SELECT * FROM plans WHERE id = ?')) {
          return plans.find((p) => p.id === args[0]) || null;
        }
        if (query.includes('SELECT * FROM users WHERE id = ?')) {
          return users.find((u) => u.id === args[0]) || null;
        }
        return null;
      },
      all: (...args: any[]) => {
        // SELECT 쿼리 파싱
        if (query.includes('SELECT * FROM plans')) {
          console.log(`[DB] Query: ${query}, Current plans count: ${plans.length}`);
          if (query.includes('ORDER BY created_at DESC')) {
            const sorted = [...plans].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            if (query.includes('LIMIT')) {
              const limit = parseInt(query.match(/LIMIT (\d+)/)?.[1] || '0');
              const result = sorted.slice(0, limit);
              console.log(`[DB] Returning ${result.length} plans (limit: ${limit})`);
              return result;
            }
            console.log(`[DB] Returning ${sorted.length} plans`);
            return sorted;
          }
          console.log(`[DB] Returning ${plans.length} plans`);
          return [...plans];
        }
        if (query.includes('SELECT * FROM schedule_items WHERE plan_id = ?')) {
          return scheduleItems
            .filter((item) => item.plan_id === args[0])
            .sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              return a.order_index - b.order_index;
            });
        }
        if (query.includes('SELECT * FROM budget_allocations WHERE plan_id = ?')) {
          return budgetAllocations.filter((item) => item.plan_id === args[0]);
        }
        if (query.includes('SELECT * FROM recommendations')) {
          if (query.includes('WHERE category = ?')) {
            return recommendations.filter((r) => r.category === args[0]);
          }
          if (query.includes('LIMIT')) {
            const limit = parseInt(query.match(/LIMIT (\d+)/)?.[1] || '0');
            return recommendations.slice(0, limit);
          }
          return recommendations;
        }
        return [];
      },
      run: (...args: any[]) => {
        // INSERT 쿼리 처리 (필요시 구현)
        return { lastInsertRowid: 0, changes: 0 };
      },
    };
  },
  exec: (query: string) => {
    // DDL 쿼리 처리 (스키마 생성 등)
    // 메모리 기반이므로 스킵
  },
};

export default db;

// 고수준 헬퍼: 계획 생성 저장
export function createPlanRecord(input: {
  userId?: number;
  destination: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  budget?: number;
  status?: string;
}): { id: number } {
  ensureDatabaseInitialized();
  const userId = input.userId ?? 1;
  const travelers = input.travelers ?? 1;
  const budget = input.budget ?? 0;
  const status = input.status ?? 'active';
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const msInDay = 1000 * 60 * 60 * 24;
  const duration =
    Math.max(1, Math.round((end.getTime() - start.getTime()) / msInDay) + 1);

  const id = planIdCounter++;
  const now = new Date().toISOString();
  const newPlan: Plan = {
    id,
    user_id: userId,
    destination: input.destination,
    start_date: input.startDate,
    end_date: input.endDate,
    duration,
    budget,
    travelers,
    preferences: JSON.stringify({}),
    status,
    created_at: now,
    updated_at: now,
  };
  
  plans.push(newPlan);
  console.log(`[DB] Plan saved: ID=${id}, Total plans: ${plans.length}`);
  console.log(`[DB] Plan data:`, newPlan);
  
  return { id };
}
