import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const openai = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL:
    process.env.DEEPSEEK_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    'https://api.deepseek.com/v1',
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    
    let messages: any[] | undefined;
    let prompt: string | undefined;

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

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const uiMessages = body.messages.map(({ id, ...rest }: { id?: string }) => rest);
      messages = await convertToModelMessages(uiMessages as any, { tools });
    } else if (typeof body?.prompt === 'string' && body.prompt.trim()) {
      prompt = body.prompt.trim();
    }

    if ((!messages || messages.length === 0) && !prompt) {
      return Response.json({ error: '缺少有效的 prompt 或 messages' }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: '未配置 API Key' }, { status: 500 });
    }

    const result = streamText({
      model: openai.chat('deepseek-chat'),
      ...(messages ? { messages } : { prompt: prompt! }),
      tools,
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('DeepSeek API 调用失败:', err);
    const message = err instanceof Error ? err.message : '服务异常';
    return Response.json({ error: message }, { status: 500 });
  }
}
