import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import postgres from 'postgres';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const sql = postgres(process.env.DATABASE_URL!);

  const chatRows = await sql.unsafe(
    'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (!chatRows[0]) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  const msgRows = await sql.unsafe(
    'SELECT id, role, content, created_at as "createdAt" FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [id]
  );

  return NextResponse.json(msgRows);
}
