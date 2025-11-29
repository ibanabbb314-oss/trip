'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calculator, Cloud, Globe, Shield, Clock, DollarSign } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="container py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>도움말</CardTitle>
          <CardDescription>
            TripGenie 사용 방법 및 주요 기능에 대해 알아보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 핵심 기능 가이드 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              핵심 기능 가이드
            </h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI 예산 계산</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    TripGenie는 최신 물가 정보를 기반으로 여행지의 평균 비용을 분석하여 최적의 총 예산을 자동으로 계산합니다. 
                    항공권, 숙박, 식사, 교통, 관광지 입장료 등을 모두 고려하여 현실적인 예산을 제시합니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">숙소 위치 선정 논리</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    AI는 주요 관광지들의 위치와 대중교통 중심 지역을 분석하여, 
                    관광지 간 이동 거리가 가장 짧고 대중교통 이용이 편리한 지역의 숙소를 추천합니다. 
                    각 계획에서 숙소 추천 이유를 확인할 수 있습니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">예산 재조정 기능</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    실제로 확인한 항공권과 숙박 가격을 입력하면, 
                    AI가 나머지 현지 지출 예산을 자동으로 재분배합니다. 
                    총 예산도 실제 가격에 맞춰 자동으로 조정됩니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">여행 계획 저장</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    생성된 여행 계획은 브라우저의 localStorage에 저장되며, 
                    프로필 페이지에서 언제든지 다시 확인할 수 있습니다. 
                    저장된 계획은 언제든지 삭제할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 유용한 부가 기능 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              유용한 부가 기능
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    날씨 정보
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://www.accuweather.com/ko/world-weather" target="_blank" rel="noopener noreferrer">
                      날씨 확인하기 <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    환율 계산
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://search.naver.com/search.naver?query=%ED%99%98%EC%9C%A8%EA%B3%84%EC%82%B0%EA%B8%B0" target="_blank" rel="noopener noreferrer">
                      환율 확인하기 <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    여행자 보험
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://direct.samsungfire.com/mall/PP030701_001.html" target="_blank" rel="noopener noreferrer">
                      보험 확인하기 <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    세계 시계
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://vclock.kr/time/" target="_blank" rel="noopener noreferrer">
                      시계 확인하기 <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">자주 묻는 질문 (FAQ)</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Q: 예산 계산은 얼마나 정확한가요?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    AI는 최신 물가 정보와 평균 비용 데이터를 기반으로 예산을 계산합니다. 
                    계절, 지역, 여행 스타일에 따라 실제 비용은 다를 수 있으므로 참고용으로 사용하시기 바랍니다.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Q: 저장된 계획은 어디에 저장되나요?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    여행 계획은 브라우저의 localStorage에 저장됩니다. 
                    브라우저 캐시를 삭제하면 저장된 계획도 함께 삭제될 수 있으니 주의하세요.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Q: 계획을 수정할 수 있나요?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    현재는 생성된 계획을 수정할 수 없지만, 예산 재조정 기능을 통해 실제 가격을 반영할 수 있습니다. 
                    새로운 계획을 생성하려면 홈 페이지에서 다시 시작하세요.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

