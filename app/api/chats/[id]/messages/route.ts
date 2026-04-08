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

  let chatRows: any[] = [];
  try {
    chatRows = await sql.unsafe(
      'SELECT id FROM "chat" WHERE id = $1 AND user_id = $2',
      [id, session.user.id]
    );
  } catch (e) {
    console.error('[messages] SELECT chat error:', e);
    return NextResponse.json({ error: '查询对话失败', detail: String(e) }, { status: 500 });
  }

  if (!chatRows[0]) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  let msgRows: any[] = [];
  try {
    msgRows = await sql.unsafe(
      'SELECT id, role, content, created_at as "createdAt" FROM message WHERE chat_id = $1 ORDER BY created_at ASC',
      [id]
    );
  } catch (e) {
    console.error('[messages] SELECT messages error:', e);
    return NextResponse.json({ error: '查询消息失败', detail: String(e) }, { status: 500 });
  }

  return NextResponse.json(msgRows);
}
