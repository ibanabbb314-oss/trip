import { format, addDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

export interface DayPlan {
  date: string;
  dateLabel: string;
  content: string;
  isSummary?: boolean;
}

export interface ParsedPlan {
  summary: string;
  dayPlans: DayPlan[];
}

export function parsePlanByDays(
  text: string,
  startDate: string,
  endDate: string
): ParsedPlan {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const dayPlans: DayPlan[] = [];

  let currentDate = start;
  while (currentDate <= end) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dateLabel = format(currentDate, 'yyyy년 MM월 dd일 (E)', { locale: ko });
    
    dayPlans.push({
      date: dateStr,
      dateLabel,
      content: '',
    });
    
    currentDate = addDays(currentDate, 1);
  }

  const lines = text.split('\n');
  const summaryLines: string[] = [];
  const dayContents: string[][] = dayPlans.map(() => []);

  let foundFirstDay = false;
  let firstDayLineIndex = -1;
  let currentDayIndex = -1;

  // 먼저 첫 번째 날짜 패턴이 나타나는 위치를 찾기
  const dayPatterns = [
    /^(\d+)[일일차]/,
    /^(\d+)일차/,
    /^(\d+)일\s*[:\-]/,
    /^Day\s*(\d+)/i,
    /^(\d+)\.\s*일/,
    /^##\s*(\d+)[일일차]/,
    /^###\s*(\d+)[일일차]/,
    /^\*\*(\d+)[일일차]\*\*/,
    /^제\s*(\d+)[일일차]/,
    /^(\d+)[일일]\s*계획/,
  ];

  // 구분자 패턴 (=== 일자별 계획 === 같은 형식)
  const separatorPatterns = [
    /^===?\s*일자별\s*계획\s*===?/,
    /^===?\s*일자별\s*일정\s*===?/,
    /^===?\s*날짜별\s*계획\s*===?/,
    /^##\s*일자별\s*계획/,
    /^##\s*일자별\s*일정/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    // 구분자 패턴 체크
    for (const pattern of separatorPatterns) {
      if (pattern.test(trimmedLine)) {
        firstDayLineIndex = i + 1; // 구분자 다음 라인부터
        foundFirstDay = true;
        break;
      }
    }
    if (foundFirstDay) break;

    // 날짜 패턴 체크
    for (const pattern of dayPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const dayNum = parseInt(match[1] || '1');
        if (dayNum >= 1 && dayNum <= dayPlans.length) {
          firstDayLineIndex = i;
          foundFirstDay = true;
          break;
        }
      }
    }
    if (foundFirstDay) break;
  }

  // 첫 번째 날짜 패턴 이전의 내용만 summary에 포함
  if (foundFirstDay && firstDayLineIndex > 0) {
    for (let i = 0; i < firstDayLineIndex; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 날짜 패턴이 포함된 라인은 summary에서 제외
      let hasDayPattern = false;
      for (const pattern of dayPatterns) {
        if (pattern.test(trimmedLine)) {
          hasDayPattern = true;
          break;
        }
      }
      
      // 날짜 관련 키워드가 포함된 라인도 제외
      const dayKeywords = [
        /\d+일차/,
        /\d+일\s*[:\-]/,
        /Day\s*\d+/i,
        /\d+\.\s*일/,
        /제\s*\d+[일일차]/,
        /\d+[일일]\s*계획/,
      ];
      
      if (!hasDayPattern) {
        for (const keyword of dayKeywords) {
          if (keyword.test(trimmedLine)) {
            hasDayPattern = true;
            break;
          }
        }
      }
      
      if (!hasDayPattern) {
        summaryLines.push(line);
      }
    }
  } else if (!foundFirstDay) {
    // 날짜 패턴이 없으면 전체를 summary로 (하지만 날짜 관련 내용은 필터링)
    for (const line of lines) {
      const trimmedLine = line.trim();
      let hasDayPattern = false;
      
      for (const pattern of dayPatterns) {
        if (pattern.test(trimmedLine)) {
          hasDayPattern = true;
          break;
        }
      }
      
      if (!hasDayPattern) {
        summaryLines.push(line);
      }
    }
  }

  // 첫 번째 날짜 패턴 이후의 내용을 날짜별로 파싱
  if (foundFirstDay && firstDayLineIndex >= 0) {
    // firstDayLineIndex부터 끝까지 순회하면서 날짜별로 분류
    for (let i = firstDayLineIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 빈 줄 처리
      if (!trimmedLine) {
        if (currentDayIndex >= 0 && currentDayIndex < dayPlans.length) {
          dayContents[currentDayIndex].push('');
        }
        continue;
      }

      // 구분자 패턴이면 건너뛰기
      let isSeparator = false;
      for (const pattern of separatorPatterns) {
        if (pattern.test(trimmedLine)) {
          isSeparator = true;
          break;
        }
      }
      if (isSeparator) continue;

      // 날짜 패턴 매칭 시도
      let matched = false;
      for (const pattern of dayPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const dayNum = parseInt(match[1] || '1');
          const targetIndex = dayNum - 1;
          
          if (targetIndex >= 0 && targetIndex < dayPlans.length) {
            currentDayIndex = targetIndex;
            dayContents[currentDayIndex].push(line);
            matched = true;
            break;
          }
        }
      }

      // 날짜 패턴이 매칭되지 않았으면 현재 날짜에 추가
      if (!matched) {
        if (currentDayIndex >= 0 && currentDayIndex < dayPlans.length) {
          dayContents[currentDayIndex].push(line);
        }
        // currentDayIndex가 -1이면 아직 첫 번째 날짜를 찾지 못한 상태
        // 이 경우는 무시 (summary에 포함되지 않도록)
      }
    }
  }

  // summary에서 날짜 관련 내용을 한 번 더 필터링
  const filteredSummaryLines = summaryLines.filter((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return true;
    
    // 구분자 패턴 체크
    for (const pattern of separatorPatterns) {
      if (pattern.test(trimmedLine)) {
        return false;
      }
    }
    
    // "=== 전체 요약 ===" 같은 구분자도 제거
    if (/^===?\s*전체\s*요약\s*===?/.test(trimmedLine)) {
      return false;
    }
    
    // 날짜 패턴 체크
    for (const pattern of dayPatterns) {
      if (pattern.test(trimmedLine)) {
        return false;
      }
    }
    
    // 날짜 관련 키워드 체크
    const dayKeywords = [
      /\d+일차/,
      /\d+일\s*[:\-]/,
      /Day\s*\d+/i,
      /\d+\.\s*일/,
      /제\s*\d+[일일차]/,
      /\d+[일일]\s*계획/,
      /^\d+일/,
    ];
    
    for (const keyword of dayKeywords) {
      if (keyword.test(trimmedLine)) {
        return false;
      }
    }
    
    return true;
  });

  const summary = filteredSummaryLines.join('\n').trim();

  // 날짜별 내용 할당
  for (let i = 0; i < dayPlans.length; i++) {
    const content = dayContents[i].join('\n').trim();
    if (content) {
      dayPlans[i].content = content;
    } else {
      const dayNum = i + 1;
      dayPlans[i].content = `## ${dayNum}일차\n\n이 날의 상세 계획이 제공되지 않았습니다.`;
    }
  }

  // 디버깅: 파싱 결과 확인
  if (typeof window !== 'undefined') {
    console.log('[PlanParser] Found first day:', foundFirstDay, 'at line:', firstDayLineIndex);
    console.log('[PlanParser] Summary length:', summary.length);
    console.log('[PlanParser] Day plans:', dayPlans.map((p, i) => ({
      day: i + 1,
      contentLength: p.content.length,
      hasContent: p.content.length > 0,
      preview: p.content.substring(0, 100),
    })));
    
    // 첫 번째 날짜 패턴 주변 텍스트 확인
    if (foundFirstDay && firstDayLineIndex >= 0 && firstDayLineIndex < lines.length) {
      console.log('[PlanParser] First day line:', lines[firstDayLineIndex]);
      console.log('[PlanParser] Lines around first day:', lines.slice(Math.max(0, firstDayLineIndex - 2), Math.min(lines.length, firstDayLineIndex + 5)));
    }
  }

  return {
    summary: summary || '전체 요약 정보가 제공되지 않았습니다.',
    dayPlans,
  };
}

