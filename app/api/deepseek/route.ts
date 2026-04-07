export const runtime = 'nodejs';

import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { auth } from '@/auth';
import postgres from 'postgres';

const openai = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL:
    process.env.DEEPSEEK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    'https://api.deepseek.com/v1',
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    const sql = postgres(process.env.DATABASE_URL!);
    const body = await req.json().catch(() => ({}));
    const { chatId, messages: uiMessages } = body as {
      chatId?: string;
      messages?: any[];
    };

    let resolvedChatId = chatId;
    let chatTitle = '新对话';

    if (!resolvedChatId) {
      const userText =
        uiMessages?.find((m) => m.role === 'user')?.content?.slice(0, 15) ??
        '新对话';
      chatTitle = userText;

      const [newChat] = await sql
        .unsafe('INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING id', [session.user.id, chatTitle])
        .then((rows: any[]) => rows[0]);
      resolvedChatId = newChat.id;
    }

    const tools = {
      getCurrentDate: tool({
        description: '获取当天的实时日期和时间。当用户询问今天几号、星期几或当前时间时调用此工具。',
        inputSchema: z.object({
          timezone: z.string().describe('需要查询的时区，默认使用 Asia/Shanghai').optional(),
        }),
        execute: async ({ timezone }: { timezone?: string }) => {
          const now = new Date();
          const targetTimeZone = typeof timezone === 'string' ? timezone : 'Asia/Shanghai';

          const dateStr = now.toLocaleDateString('zh-CN', {
            timeZone: targetTimeZone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          });

          const timeStr = now.toLocaleTimeString('zh-CN', {
            timeZone: targetTimeZone,
            hour: '2-digit',
            minute: '2-digit',
          });

          return `当前的真实系统时间是：${dateStr} ${timeStr}`;
        },
      }),
    };

    let modelMessages: any[] | undefined;
    let prompt: string | undefined;

    if (Array.isArray(uiMessages) && uiMessages.length > 0) {
      const filteredMessages = uiMessages.map(({ id, ...rest }: { id?: string }) => rest);
      modelMessages = await convertToModelMessages(filteredMessages as any, { tools });
    } else if (typeof body?.prompt === 'string' && body.prompt.trim()) {
      prompt = body.prompt.trim();
    }

    if ((!modelMessages || modelMessages.length === 0) && !prompt) {
      return Response.json({ error: '缺少有效的 prompt 或 messages' }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: '未配置 API Key' }, { status: 500 });
    }

    const chatIdForFinish = resolvedChatId!;
    const userMsg = modelMessages?.find((m) => m.role === 'user');

    const result = streamText({
      model: openai.chat('deepseek-chat'),
      ...(modelMessages ? { messages: modelMessages } : { prompt: prompt! }),
      tools,
      stopWhen: stepCountIs(3),
      onFinish: async ({ text }) => {
        await sql
          .unsafe('INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)', [
            chatIdForFinish,
            'user',
            typeof userMsg?.content === 'string' ? userMsg.content : JSON.stringify(userMsg?.content ?? ''),
          ]);
        await sql
          .unsafe('INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)', [
            chatIdForFinish,
            'assistant',
            text,
          ]);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('DeepSeek API 调用失败:', err);
    const message = err instanceof Error ? err.message : '服务异常';
    return Response.json({ error: message }, { status: 500 });
  }
}
