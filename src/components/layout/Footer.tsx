'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold mb-4">TripGenie</h3>
            <p className="text-sm text-muted-foreground">
              AI 기반 여행 계획 추천 서비스
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">서비스</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/plans/create" className="hover:text-primary">
                  여행 계획 만들기
                </Link>
              </li>
              <li>
                <Link href="/explore/recommendations" className="hover:text-primary">
                  추천 탐색
                </Link>
              </li>
              <li>
                <Link href="/help/live" className="hover:text-primary">
                  실시간 도움말
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">정보</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary">
                  서비스 소개
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary">
                  이용약관
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">문의</h4>
            <p className="text-sm text-muted-foreground">
              support@tripgenie.com
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2024 TripGenie. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

