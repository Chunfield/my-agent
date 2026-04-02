# 登录注册与对话存储集成方案 (Next.js + Vercel + NextAuth + Drizzle)

## 1. 方案概述 (Summary)
为了进一步完善 DeepSeek Agent 应用，我们将为其添加用户认证体系和对话数据的云端持久化存储功能。
* **部署平台**: Vercel (原生支持 Next.js 和 Serverless 数据库)
* **认证服务**: NextAuth.js (Auth.js) - Next.js 社区的标配，提供安全、灵活的会话管理，并提供官方的数据库适配器。
* **数据库引擎**: Vercel Postgres - Vercel 提供的 Serverless 关系型数据库，具有出色的性能和低延迟。
* **数据库 ORM**: Drizzle ORM - 轻量级、类型安全的现代 ORM，原生支持 Edge Runtime 环境，与 Vercel Postgres 配合极佳。

## 2. 当前状态分析 (Current State Analysis)
* 目前项目 (`app/page.tsx` 和 `/api/deepseek/route.ts`) 是一个纯前端状态的 AI 对话应用。
* 消息状态完全由 `@ai-sdk/react` 的 `useChat` Hook 在浏览器内存中维护，一旦刷新页面，所有对话数据就会丢失。
* 应用缺乏多会话（Sessions/Chats）的管理能力（左侧边栏的“最近记录”目前只是一个静态占位或仅显示当前临时对话）。
* 没有用户身份标识（User Identity），所有人使用的是同一个匿名环境。

## 3. 详细实施计划 (Proposed Changes)

### 步骤一：环境与依赖准备
* 在 Vercel 控制台的 Storage 选项卡中创建一个 **Postgres** 数据库实例。
* 安装所需的核心依赖：
  * **认证**: `next-auth@beta`
  * **数据库/ORM**: `drizzle-orm`, `@vercel/postgres`, `@auth/drizzle-adapter`
  * **数据库迁移工具**: `drizzle-kit`, `tsx` (用于开发时)

### 步骤二：数据库 Schema 设计与 ORM 配置
1. 创建 `db/schema.ts` 文件，定义关系型数据表：
   * **NextAuth 必需表**: `users`, `accounts`, `sessions`, `verificationTokens` (用于管理用户、第三方授权和登录态)。
   * **业务表 - Chats**: `chats` (字段包括 `id`, `userId`, `title`, `createdAt`)，用于存储多组对话。
   * **业务表 - Messages**: `messages` (字段包括 `id`, `chatId`, `role`, `content`, `createdAt`)，用于存储对话的具体内容。
2. 创建 `db/index.ts` 用于初始化 Drizzle 连接。
3. 配置 `drizzle.config.ts` 以连接 Vercel Postgres，后续将通过 `drizzle-kit push` 将表结构推送到线上数据库。

### 步骤三：集成 NextAuth.js 认证体系
1. 在项目根目录创建 `auth.ts`，配置 NextAuth：
   * 接入 `@auth/drizzle-adapter` 以将用户数据持久化到 Vercel Postgres。
   * 配置登录 Provider。为了快速验证并提供极佳的用户体验，推荐首选 **GitHub OAuth**。
2. 创建 API 路由 `app/api/auth/[...nextauth]/route.ts` 处理授权回调。
3. 修改顶层 `app/layout.tsx` 或在组件树中注入登录态 (基于服务器组件直接获取 session，或通过 `SessionProvider`)。

### 步骤四：后端 AI 接口改造 (API Routes)
1. **新建数据读取 API**:
   * `/api/chats` (GET): 查询当前登录用户的所有历史会话列表。
   * `/api/chats/[id]/messages` (GET): 根据会话 ID 获取对应的历史消息列表。
2. **重构流式对话接口 (`app/api/deepseek/route.ts`)**:
   * 接口需要接收前端传来的 `chatId`（如果是新对话，则为空）。
   * 鉴权：校验用户是否已登录。
   * 首次对话：在数据库 `chats` 表中创建一条新记录，并自动生成一个 Title（例如截取用户前十个字）。
   * 存储 User 消息：将用户发送的文本存入 `messages` 表。
   * 存储 AI 消息：利用 Vercel AI SDK 中 `streamText` 的 `onFinish` 回调钩子，在流式传输结束后将完整的 AI 响应存入 `messages` 表。

### 步骤五：前端 UI 与交互逻辑改造 (`app/page.tsx` 等)
1. **登录/登出 UI**: 在页面顶部或侧边栏底部添加用户模块。未登录时显示“使用 GitHub 登录”按钮；已登录时显示用户头像及“登出”按钮。
2. **多会话侧边栏**: 
   * 改造侧边栏，动态拉取并渲染 `/api/chats` 返回的历史对话列表。
   * 点击某条历史记录时，更新当前的 `chatId` 状态。
3. **`useChat` 适配**: 
   * 当切换 `chatId` 时，先从 `/api/chats/[id]/messages` 拉取历史消息记录。
   * 将获取到的记录作为 `initialMessages` 传入 `useChat`。
   * 发送消息时，通过 `body` 参数将当前的 `chatId` 传递给后端的 `/api/deepseek`。
4. **未登录拦截**: 未登录状态下，输入框 disabled 或点击发送时弹出登录提示。

## 4. 假设与决策 (Assumptions & Decisions)
* **认证方式**: 考虑到快速跑通且不涉及繁琐的密码加密、找回密码等流程，计划首选 **GitHub OAuth** 作为演示。这需要你（用户）在 GitHub Developer Settings 中申请一个 OAuth App，并在本地 `.env.local` 和 Vercel 环境变量中填入 `AUTH_GITHUB_ID` 和 `AUTH_GITHUB_SECRET`。
* **数据安全**: 所有的 `chats` 和 `messages` 查询都会基于当前 session 中的 `userId` 进行过滤（Row-Level Security / 逻辑隔离），确保用户只能看到自己的对话。
* **开发流程**: 不使用复杂的本地 docker 数据库，直接连接 Vercel Postgres 进行开发（需要你在 Vercel 拉取 `.env` 环境变量）。

## 5. 验证步骤 (Verification Steps)
1. **数据库迁移测试**: 运行 `drizzle-kit push` 能够成功在 Vercel Postgres 中创建所有数据表。
2. **登录测试**: 点击“登录”按钮能够跳转 GitHub，授权后能成功回到首页并显示头像。此时查看数据库的 `users` 表，应有该用户的记录。
3. **对话存储测试**: 发送一条消息（如“你好”），等待 AI 回复完毕。刷新页面，消息依旧存在。查看数据库的 `messages` 表，应有两条新记录（一条 user，一条 assistant）。
4. **多会话测试**: 点击侧边栏的“新对话”，发送一条新消息。刷新页面后，侧边栏应展示两个不同的历史对话记录，且点击能正确切换聊天上下文。
