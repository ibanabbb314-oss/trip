'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, MapPin } from 'lucide-react';

export default function LiveHelpPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: '안녕하세요! TripGenie 실시간 도움말입니다. 무엇을 도와드릴까요?',
    },
  ]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: message,
    };

    setMessages([...messages, userMessage]);
    setMessage('');

    // 간단한 봇 응답 시뮬레이션
    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        type: 'bot',
        content: '현재 위치 기반 추천을 위해 위치 정보 접근 권한이 필요합니다. 위치를 공유해주시면 근처 맛집과 관광지를 추천해드릴 수 있습니다.',
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">실시간 도움말</h1>
        <p className="text-muted-foreground">
          여행 중 궁금한 점을 실시간으로 물어보세요. AI가 즉시 답변해드립니다.
        </p>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>AI 어시스턴트</CardTitle>
          <CardDescription className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            위치 기반 추천 가능
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex space-x-2">
            <Input
              placeholder="질문을 입력하세요... (예: 지금 근처 맛집 추천해줘)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">위치 기반 추천</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              현재 위치를 기반으로 근처 맛집, 관광지를 추천해드립니다.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">긴급 대안 제시</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              계획된 장소가 영업 중단이거나 날씨 문제가 있을 때 대안을 제시합니다.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">실시간 질의응답</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              여행 중 궁금한 점을 즉시 물어보고 답변을 받을 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

