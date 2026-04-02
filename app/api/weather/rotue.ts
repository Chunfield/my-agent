import { generateText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// 1. 初始化模型客户端
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // 如果你用的是国内兼容 OpenAI 的大模型（如 DeepSeek），取消下一行的注释并修改
  // baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  // 2. 调用 Agent
  const result = await generateText({
    model: openai('gpt-4o-mini'), // 替换为你实际使用的模型名称，比如 'deepseek-chat'
    prompt: prompt,
    // 3. 给 Agent 提供工具
    tools: {
      getWeather: tool({
        description: '获取指定城市的当前实时天气',
        // 定义工具需要的参数，LLM 会自动提取城市名字传进来
        inputSchema: z.object({
          city: z.string().describe('城市名称，例如：北京、上海'),
        }),
        // 当 LLM 决定调用此工具时，会执行这里的代码
        execute: async ({ city }: { city: string }) => {
          console.log(`Agent 正在调用天气工具查询：${city}`);

          // 在真实生产中，这里应该调用真实的天气 API (如和风天气、心知天气)
          // 为了演示，我们随机返回一个模拟天气给 Agent
          const mockWeathers = ['晴朗，22℃', '多云，18℃', '小雨，15℃', '大风，20℃'];
          const randomWeather = mockWeathers[Math.floor(Math.random() * mockWeathers.length)];

          // 将结果返回给大模型
          return `${city}现在的天气是：${randomWeather}`;
        },
      }),
    },
    // 允许 Agent 最多执行几次操作（思考 -> 调用工具 -> 获取结果 -> 总结输出）
    stopWhen: stepCountIs(3),
  });

  // 将 Agent 最终组织好的自然语言返回给前端
  return Response.json({ text: result.text });
}