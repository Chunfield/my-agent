import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { chats, messages } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userChats = await db
    .select({
      id: chats.id,
      title: chats.title,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(eq(chats.userId, session.user.id))
    .orderBy(desc(chats.createdAt));

  return NextResponse.json(userChats);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const newChat = await db
    .insert(chats)
    .values({
      userId: session.user.id,
      title: '新对话',
    })
    .returning();

  return NextResponse.json(newChat[0], { status: 201 });
}
