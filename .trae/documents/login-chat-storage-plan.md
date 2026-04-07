# 登录注册与对话存储实现计划

## 1. 目标概述
为已部署至 Vercel 的 DeepSeek Agent 应用添加用户认证体系（NextAuth.js + GitHub OAuth）和对话历史云端持久化功能（Vercel Postgres + Drizzle ORM）。目标群体：所有希望记录多轮对话上下文、随时查看历史记录的用户。

## 2. 当前状态
- **前端**: [page.tsx](file:///Users/goumomo/Desktop/Project/my-app-agent/app/page.tsx) — 纯浏览器内存状态，`useChat` 生命周期随页面刷新丢失。
- **后端**: [route.ts](file:///Users/goumomo/Desktop/Project/my-app-agent/app/api/deepseek/route.ts) — 无鉴权，不持久化消息。
- **数据库**: 无。
- **认证**: 无。

## 3. 技术选型
| 模块 | 选型 | 说明 |
|------|------|------|
| 认证 | **NextAuth.js v5 (beta)** + `@auth/drizzle-adapter` | Next.js 社区标配，支持 GitHub OAuth |
| 数据库 | **Vercel Postgres** | Vercel Storage 内置 Serverless SQL |
| ORM | **Drizzle ORM** | 轻量、类型安全、Edge 友好 |
| 迁移工具 | `drizzle-kit` + `tsx` | 开发期推送 Schema 到线上 |
| 登录方式 | **GitHub OAuth** | 最简验证流程，无需密码/邮箱 |

## 4. 实施步骤

### 步骤 1：环境准备
1. 在 Vercel 项目中创建 **Postgres** 数据库（Storage → Create Database → Postgres），复制连接字符串备用。
2. 在本地 `.env.local` 中添加 `DATABASE_URL`，在 Vercel 项目 Settings → Environment Variables 中也添加同名变量（值为上一步的连接字符串）。
3. 安装依赖：
   ```bash
   npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @vercel/postgres
   npm install -D drizzle-kit tsx
   ```

### 步骤 2：数据库 Schema 设计
新建 [db/schema.ts](file:///Users/goumomo/Desktop/Project/my-app-agent/db/schema.ts)，定义以下表：

**NextAuth 必需表**（`@auth/drizzle-adapter` 依赖）：
- `users` — id, name, email, emailVerified, image, createdAt…
- `accounts` — OAuth 账户绑定
- `sessions` — 会话令牌
- `verificationTokens` — 邮箱验证令牌

**业务表**：
- `chats` — id (uuid), userId → users.id, title (新对话前 15 字), createdAt, updatedAt
- `messages` — id (uuid), chatId → chats.id, role (user/assistant), content (text), createdAt

### 步骤 3：配置 NextAuth
1. 新建 [auth.ts](file:///Users/goumomo/Desktop/Project/my-app-agent/auth.ts)（根目录），配置 GitHub Provider + Drizzle Adapter。
2. 新建 `app/api/auth/[...nextauth]/route.ts` 作为认证回调入口。
3. 在 [layout.tsx](file:///Users/goumomo/Desktop/Project/my-app-agent/app/layout.tsx) 中通过 `await auth()` 获取 session，将用户信息（头像/登出按钮）渲染到页面顶部。

### 步骤 4：构建 API（对话持久化）
1. **GET `/api/chats`** — 返回当前用户所有会话列表（id + title + createdAt）
2. **GET `/api/chats/[id]/messages`** — 返回指定会话的所有消息
3. **POST `/api/deepseek`** — 改造现有接口：
   - 从请求体取 `chatId`（可选）
   - 未登录 → 401；未带 `chatId` → 先在 DB 创建 `chats` 记录
   - 用 `onFinish` 回调将 user 和 assistant 两条消息写入 `messages` 表

### 步骤 5：前端改造
1. **登录控件** — 在 [page.tsx](file:///Users/goumomo/Desktop/Project/my-app-agent/app/page.tsx) 顶栏右侧添加"登录/头像"按钮，未登录时禁用输入框并提示登录。
2. **历史侧边栏** — 将"最近记录"改为动态 fetch `/api/chats`，支持点击切换 `chatId`。
3. **useChat 适配** — 切换 `chatId` 时，先 fetch `/api/chats/[id]/messages` 作为 `initialMessages`，发消息时通过 `body.chatId` 传递。
4. **新对话按钮** — 清空本地状态并置 `chatId = null`。

### 步骤 6：GitHub OAuth 配置
在 GitHub → Settings → Developer settings → OAuth Apps 新建 App：
- Homepage URL: `https://你的vercel域名`
- Callback URL: `https://你的vercel域名/api/auth/callback/github`
- 将 `AUTH_GITHUB_ID` 和 `AUTH_GITHUB_SECRET` 填入 Vercel 环境变量。

### 步骤 7：数据库迁移
开发完成后，本地执行：
```bash
npx drizzle-kit push
```
将 Schema 推送到 Vercel Postgres。随后提交代码，Vercel 自动重新部署。

## 5. 验证清单
- [ ] 访问 `/api/auth/signin` 可跳转 GitHub 授权页
- 授权后页面右上角显示 GitHub 头像
- 发送消息 → 刷新页面，对话仍在
- 侧边栏出现历史会话列表，点击可加载历史消息
- 多设备登录（不同浏览器）各自独立会话和数据

## 6. 注意事项
- 所有 `chats` / `messages` 查询必须附加 `userId` 过滤条件，防止跨用户数据泄露。
- `messages.content` 使用 `text` 类型（Postgres 无长度限制），不使用 `varchar`。
- 首次部署认证时，Vercel Postgres 冷启动约 5s，后续自动缓存连接。
