# TripGenie - AI 기반 여행 계획 추천 서비스

대학생을 위한 AI 기반 여행 계획 추천 서비스입니다. 여행지를 입력하면 예산부터 일정까지 모든 것을 AI가 최적화해드립니다.

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Lucide React

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── home/              # 홈 페이지
│   ├── plans/             # 여행 계획 관련 페이지
│   │   ├── create/        # 계획 생성
│   │   └── [planId]/      # 계획 상세
│   ├── explore/           # 추천 탐색
│   │   └── recommendations/
│   └── help/              # 실시간 도움말
│       └── live/
├── components/
│   ├── layout/            # Layout 컴포넌트
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/                # shadcn/ui 컴포넌트
├── lib/
│   └── db.ts              # SQLite 데이터베이스 설정
└── hooks/                 # 커스텀 훅
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# AI Provider Configuration
# Options: openai, anthropic, together, perplexity
AI_PROVIDER=openai

# AI API Key
# Get your API key from:
# - OpenAI: https://platform.openai.com/api-keys
# - Anthropic: https://console.anthropic.com/
# - Together AI: https://api.together.xyz/
# - Perplexity: https://www.perplexity.ai/
AI_API_KEY=your_api_key_here
```

**중요**: `.env.local` 파일은 Git에 커밋되지 않습니다. 실제 API 키를 입력하세요.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 주요 페이지

### 홈 (`/home`)
- 서비스 소개
- 최근 계획 미리보기
- 추천 장소 미리보기
- 빠른 계획 생성 시작

### 여행 계획 생성 (`/plans/create`)
- 여행지, 기간, 인원, 예산 입력
- 예산 최적화 모드 지원

### 내 계획 (`/plans`)
- 생성된 모든 여행 계획 목록
- 계획별 상세 정보 확인

### 계획 상세 (`/plans/[planId]`)
- 일정 탭: 날짜별 일정 확인
- 예산 탭: 예산 배분 및 사용 현황
- 장소 탭: 추천 장소 목록

### 추천 탐색 (`/explore/recommendations`)
- 카테고리별 추천 장소 탐색
- 선호도 기반 맞춤 추천
- 장소 상세 정보 확인

### 실시간 도움말 (`/help/live`)
- AI 챗봇 인터페이스
- 위치 기반 실시간 추천
- 긴급 상황 대안 제시

## 데이터베이스 스키마

### users
- 사용자 정보

### plans
- 여행 계획 정보
- 목적지, 기간, 예산, 인원 등

### schedule_items
- 일정 아이템
- 날짜별, 시간별 장소 정보

### budget_allocations
- 예산 배분
- 카테고리별 예산 할당

### recommendations
- 추천 장소 정보
- 카테고리, 평점, 가격 등

## 예시 데이터

프로젝트에는 제주도 여행 계획 예시 데이터가 포함되어 있습니다:
- 2박 3일 제주도 여행 계획
- 일정 아이템 5개
- 예산 배분 4개 카테고리
- 추천 장소 4개

## 다음 단계

1. AI 통합 (GPT-4/Claude API 연동)
2. 사용자 인증 시스템
3. 실시간 위치 기반 추천
4. 그룹 협업 기능
5. 예산 시뮬레이션 고도화

## 라이선스

MIT

