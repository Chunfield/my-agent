import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import postgres from 'postgres';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = postgres(process.env.DATABASE_URL!);

  const rows = await sql.unsafe(
    'SELECT id, title, created_at as "createdAt", updated_at as "updatedAt" FROM "chat" WHERE user_id = $1 ORDER BY created_at DESC',
    [session.user.id]
  );

  return NextResponse.json(rows);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = postgres(process.env.DATABASE_URL!);

  const rows = await sql.unsafe(
    'INSERT INTO "chat" (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at as "createdAt", updated_at as "updatedAt"',
    [session.user.id, '新对话']
  );

  return NextResponse.json(rows[0], { status: 201 });
}
