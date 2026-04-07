import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chats, messages } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const chat = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, session.user.id)))
    .limit(1);

  if (!chat[0]) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  const chatMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(asc(messages.createdAt));

  return NextResponse.json(chatMessages);
}
