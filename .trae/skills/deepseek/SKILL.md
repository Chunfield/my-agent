---
name: "deepseek"
description: "Calls DeepSeek models via OpenAI-compatible API. Invoke when user requests DeepSeek output or explicitly asks to use DeepSeek."
---

# DeepSeek Caller

This skill routes requests to DeepSeek models using the OpenAI-compatible API, integrating with the Vercel AI SDK in this workspace.

## When to Invoke
- User explicitly asks to use DeepSeek
- Tasks require DeepSeek model responses
- You need to switch the model to DeepSeek for generation

## Prerequisites
- Environment variable: `DEEPSEEK_API_KEY` (or reuse `OPENAI_API_KEY`)
- Optional: `DEEPSEEK_BASE_URL` (defaults to `https://api.deepseek.com/v1`)

## Usage
- Use the API route `/api/deepseek` with body `{ "prompt": "<your text>" }`
- The route forwards the prompt to DeepSeek and returns `{ "text": "<model output>" }`

## Model Selection
- Default model: `deepseek-chat`
- You may switch to other DeepSeek models as needed

## Notes
- Keep prompts concise and explicit
- Avoid sending secrets in prompts
