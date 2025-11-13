# Vercel 배포 체크리스트

## 1. 환경 변수 설정 (필수)
Vercel 대시보드 > Settings > Environment Variables에서 다음 변수들을 설정하세요:

- `AI_PROVIDER`: `google` 또는 `openai`, `anthropic`, `together`, `perplexity`
- `AI_API_KEY`: AI API 키
- `GOOGLE_MODEL`: (선택) Google 모델명 (기본값: `gemini-2.5-flash`)

## 2. 빌드 설정 확인
- Node.js 버전: 18.x 이상 권장
- Build Command: `npm run build` (기본값)
- Output Directory: `.next` (기본값)

## 3. 수정된 사항
- ✅ `date-fns/locale` import 경로 수정 (`date-fns/locale/ko`)
- ✅ `server-only` 패키지 확인
- ✅ TypeScript 설정 확인

## 4. 배포 후 확인사항
- API 라우트 (`/api/plan`) 동작 확인
- 환경 변수 로드 확인
- 빌드 로그에서 에러 확인

## 5. 일반적인 오류 해결
- **환경 변수 오류**: Vercel 대시보드에서 환경 변수 설정 확인
- **빌드 타임 에러**: 로컬에서 `npm run build` 실행하여 확인
- **런타임 에러**: Vercel 함수 로그 확인

