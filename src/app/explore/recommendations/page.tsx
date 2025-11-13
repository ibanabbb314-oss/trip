import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Star } from 'lucide-react';
import db, { ensureDatabaseInitialized } from '@/lib/db';

async function getRecommendations(category?: string) {
  ensureDatabaseInitialized();
  if (category) {
    return db.prepare('SELECT * FROM recommendations WHERE category = ?').all(category);
  }
  return db.prepare('SELECT * FROM recommendations').all();
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const recommendations = await getRecommendations(params.category);

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'photospot', label: '사진 명소' },
    { id: 'food', label: '맛집' },
    { id: 'attraction', label: '관광지' },
    { id: 'beach', label: '해변' },
    { id: 'cafe', label: '카페' },
  ];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">추천 장소 탐색</h1>
        <p className="text-muted-foreground">
          선호도 기반 맞춤 추천과 카테고리별 장소를 탐색해보세요.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={params.category === category.id ? 'default' : 'outline'}
            asChild
          >
            <Link
              href={
                category.id === 'all'
                  ? '/explore/recommendations'
                  : `/explore/recommendations?category=${category.id}`
              }
            >
              {category.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map((rec: any) => (
          <Card key={rec.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video bg-muted relative">
              <img
                src={rec.image_url || 'https://picsum.photos/400/300'}
                alt={rec.place_name}
                className="w-full h-full object-cover"
              />
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{rec.place_name}</CardTitle>
                <Badge variant="secondary">{rec.category}</Badge>
              </div>
              <CardDescription>{rec.address}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {rec.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{rec.price_range}</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">{rec.rating}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/explore/recommendations/${rec.id}`}>자세히 보기</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">추천 장소가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

