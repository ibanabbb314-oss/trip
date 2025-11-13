import { NextResponse } from 'next/server';
import { generateText } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt. Prompt must be a non-empty string.' },
        { status: 400 }
      );
    }

    const text = await generateText({ prompt });
    return NextResponse.json({ text });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

