# TripGenie 웹사이트 작동 구조

## 개요

**TripGenie**는 AI 기반 여행 계획 추천 서비스로, 사용자가 여행 정보를 입력하면 AI가 맞춤형 여행 계획을 생성해주는 Next.js 15 기반 웹 애플리케이션입니다.

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **UI 컴포넌트**: shadcn/ui (Radix UI)
- **상태 관리**: 
  - React Query (`@tanstack/react-query`) - 서버 상태
  - Zustand - 글로벌 상태
- **AI 통합**: 
  - Google Gemini (기본)
  - OpenAI GPT-4
  - Anthropic Claude
  - Together AI
  - Perplexity AI
- **데이터 저장**: 
  - 메모리 기반 DB (개발용)
  - 파일 시스템 기반 저장 (`planStore.ts`)
  - localStorage (클라이언트)

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저 (클라이언트)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Next.js App Router Pages                        │   │
│  │  - /home (홈 페이지)                             │   │
│  │  - /plan-result (결과 표시)                      │   │
│  │  - /plans (계획 목록)                            │   │
│  │  - /generate (AI 생성기)                         │   │
│  └──────────────────────────────────────────────────┘   │
│                        ↕                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  React Query Provider                           │   │
│  │  Theme Provider (next-themes)                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↕ HTTP API
┌─────────────────────────────────────────────────────────┐
│                  Next.js 서버 (Server)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  API Routes                                      │   │
│  │  - /api/plan (POST) - 여행 계획 생성            │   │
│  │  - /api/generate (POST) - AI 텍스트 생성        │   │
│  └──────────────────────────────────────────────────┘   │
│                        ↕                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AI Service (lib/ai.ts)                         │   │
│  │  - generateText()                               │   │
│  │  - 재시도 로직 포함                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↕ HTTP API
┌─────────────────────────────────────────────────────────┐
│                  외부 AI 서비스                           │
│  - Google Gemini API                                    │
│  - OpenAI API                                           │
│  - Anthropic Claude API                                 │
│  - Together AI API                                      │
│  - Perplexity AI API                                    │
└─────────────────────────────────────────────────────────┘
```

## 주요 페이지별 작동 흐름

### 1. 홈 페이지 (`/home`)

**파일**: `src/app/home/page.tsx`

**작동 흐름**:

```
사용자 입력 (여행지, 날짜, 인원, 예산)
    ↓
[제출 버튼 클릭]
    ↓
POST /api/plan
    ↓
AI가 JSON 형식의 여행 계획 생성
    ↓
결과를 localStorage에 저장 (임시 키: plan-result-{timestamp})
    ↓
새 탭으로 /plan-result?key={resultKey} 열기
    ↓
결과 페이지에서 localStorage에서 데이터 로드
```

**주요 기능**:
- 여행 정보 입력 폼
- 실시간 검증 (필수 필드 체크)
- 로딩 상태 표시
- 에러 처리

### 2. 여행 계획 생성 API (`/api/plan`)

**파일**: `src/app/api/plan/route.ts`

**작동 흐름**:

```
1. 요청 검증
   - destination, startDate, endDate 필수 체크
   ↓
2. 날짜 계산
   - startDate ~ endDate 사이의 모든 날짜 배열 생성
   ↓
3. AI 프롬프트 생성
   - JSON 스키마 정의 포함
   - 여행 정보 포함
   ↓
4. AI 호출 (lib/ai.ts)
   - generateText() 함수로 JSON 응답 요청
   ↓
5. JSON 파싱
   - 마크다운 코드블럭 제거
   - 순수 JSON 추출
   - 검증 (days 배열 존재 여부)
   ↓
6. 응답 반환
   - planId 생성
   - summary, days 포함한 구조화된 데이터 반환
```

**AI 프롬프트 구조**:
- 요구사항: JSON 형식으로만 응답
- 스키마:
  - `summary`: 예산, 팁, 개요, 주의사항
  - `days[]`: 날짜별 계획
    - `date`: 날짜
    - `title`: 제목
    - `summary`: 요약
    - `items[]`: 시간별 활동

### 3. 결과 표시 페이지 (`/plan-result`)

**파일**: `src/app/plan-result/page.tsx`

**작동 흐름**:

```
1. URL에서 key 파라미터 추출
   ↓
2. localStorage에서 데이터 로드 (재시도 로직 포함)
   ↓
3. 데이터 파싱 및 상태 설정
   ↓
4. 탭 UI로 표시
   - 전체 요약 탭
   - 날짜별 탭 (1일차, 2일차, ...)
   ↓
5. 사용 후 localStorage에서 데이터 삭제
```

**주요 기능**:
- 탭 기반 UI (전체 요약 + 날짜별)
- 예산 분배 시각화
- 시간별 일정 표시
- 복사 기능 (전체 데이터 JSON)
- 새 탭으로 열림

### 4. AI 서비스 (`lib/ai.ts`)

**파일**: `src/lib/ai.ts`

**주요 기능**:

1. **다중 AI 프로바이더 지원**
   - 환경변수 `AI_PROVIDER`로 선택
   - 기본값: `google` (Gemini)

2. **재시도 로직**
   - 503, 429, 500-599 오류 시 재시도
   - 지수 백오프 (1초, 2초, 4초...)
   - 최대 3회 재시도

3. **프로바이더별 구현**
   - **Google Gemini**: `gemini-2.5-flash` 모델
   - **OpenAI**: `gpt-4o-mini` 모델
   - **Anthropic**: `claude-3-5-sonnet-latest` 모델
   - **Together AI**: `meta-llama/Llama-3-8b-chat-hf`
   - **Perplexity**: `llama-3.1-sonar-small-128k-online`

**환경변수**:
- `AI_PROVIDER`: 프로바이더 선택
- `AI_API_KEY`: API 키
- `GOOGLE_MODEL`: Gemini 모델명 (선택)

### 5. 데이터 저장 방식

**클라이언트 사이드**:
- `localStorage`: 생성된 계획 결과 임시 저장
  - 키 형식: `plan-result-{timestamp}`
  - 사용 후 자동 삭제

**서버 사이드**:
- `lib/planStore.ts`: 파일 시스템 기반 저장
  - 경로: `data/plans.json`
  - 현재는 사용되지 않음 (향후 확장용)

- `lib/db.ts`: 메모리 기반 데이터베이스
  - 개발/프로토타입용
  - 서버 재시작 시 초기화
  - 현재는 예시 데이터만 포함

## 컴포넌트 구조

### 레이아웃 컴포넌트

**Header** (`src/components/layout/Header.tsx`):
- 네비게이션 메뉴
- 반응형 디자인 (모바일/데스크톱)
- 활성 경로 표시

**Footer** (`src/components/layout/Footer.tsx`):
- 푸터 정보

### UI 컴포넌트

shadcn/ui 기반 컴포넌트들:
- `Button`, `Card`, `Input`, `Textarea`
- `Tabs`, `Badge`, `Avatar`
- `Toast`, `Sheet`, `Accordion`

## 상태 관리

### React Query
- 서버 상태 관리
- `staleTime: 60초` 설정
- SSR 호환성 고려

### Zustand
- 글로벌 클라이언트 상태
- 현재 코드베이스에서는 사용되지 않음

### Local State
- React `useState` 훅
- 각 페이지/컴포넌트별 로컬 상태

## 스타일링

- **Tailwind CSS**: 유틸리티 퍼스트 CSS
- **반응형 디자인**: 모바일 우선 접근
- **다크 모드**: `next-themes`로 지원
- **애니메이션**: `tailwindcss-animate`

## 환경 설정

### 필수 환경변수

```env
# AI Provider (google, openai, anthropic, together, perplexity)
AI_PROVIDER=google

# AI API Key
AI_API_KEY=your_api_key_here

# Google Model (선택, 기본값: gemini-2.5-flash)
GOOGLE_MODEL=gemini-2.5-flash
```

## 데이터 흐름 요약

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │ 1. 여행 정보 입력
       ↓
┌─────────────────────────┐
│  /home 페이지 (폼)      │
└──────┬──────────────────┘
       │ 2. POST /api/plan
       ↓
┌─────────────────────────┐
│  /api/plan API Route    │
│  - 요청 검증            │
│  - 프롬프트 생성        │
└──────┬──────────────────┘
       │ 3. generateText()
       ↓
┌─────────────────────────┐
│  lib/ai.ts              │
│  - AI API 호출          │
│  - 재시도 로직          │
└──────┬──────────────────┘
       │ 4. AI 응답 (JSON)
       ↓
┌─────────────────────────┐
│  /api/plan              │
│  - JSON 파싱            │
│  - 검증                 │
└──────┬──────────────────┘
       │ 5. 구조화된 데이터 반환
       ↓
┌─────────────────────────┐
│  /home 페이지           │
│  - localStorage 저장    │
│  - 새 탭 열기           │
└──────┬──────────────────┘
       │ 6. /plan-result?key=...
       ↓
┌─────────────────────────┐
│  /plan-result 페이지    │
│  - localStorage 로드    │
│  - 결과 표시            │
└─────────────────────────┘
```

## 주요 특징

1. **JSON 기반 구조화된 응답**
   - AI가 JSON 형식으로 응답
   - 날짜별, 시간별 일정 구조화

2. **에러 처리 및 재시도**
   - AI API 오류 시 자동 재시도
   - 친절한 에러 메시지

3. **임시 저장소 활용**
   - localStorage로 결과 임시 저장
   - 새 탭에서 결과 표시
   - 사용 후 자동 삭제

4. **타입 안정성**
   - TypeScript 전면 사용
   - 인터페이스로 데이터 구조 명확화

5. **반응형 디자인**
   - 모바일/태블릿/데스크톱 지원
   - Tailwind CSS 유틸리티 활용

## 향후 개선 사항

1. **데이터베이스 통합**
   - Supabase 연동 (현재 메모리 DB만 사용)
   - 사용자별 계획 저장
   - 계획 공유 기능

2. **인증 시스템**
   - 사용자 로그인/회원가입
   - 계획별 접근 제어

3. **계획 편집 기능**
   - 생성된 계획 수정
   - 재생성 옵션

4. **실시간 추천**
   - 위치 기반 추천
   - 날씨 기반 일정 조정

5. **예산 추적**
   - 실제 지출 기록
   - 예산 vs 실제 비교

