import { NextRequest, NextResponse } from 'next/server';
import { getConversation } from '@/lib/services/elevenLabsService';

export async function GET(_: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  try {
    const data = await getConversation(conversationId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
