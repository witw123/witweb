# WitWeb 架构与开发工作流

## 1. 当前状态

本文档描述 2026-03-06 时点的 WitWeb 实际结构，重点覆盖：

- 代码分层
- 认证链路
- 客户端数据获取模式
- repository 边界
- 测试与 CI 基线
- 后续开发约定

如果本文档与代码冲突，应以代码为准，再同步更新本文档。

## 2. 系统结构

WitWeb 当前是一个单体全栈应用，主体在 `web/`。

核心技术：

- Next.js App Router
- React 19
- TypeScript
- PostgreSQL
- Vitest
- Playwright

系统按功能可分为四条主线：

- 社区内容：文章、分类、评论、点赞、收藏
- 社交互动：关注、粉丝、私信、通知
- 后台管理：用户、文章、分类、审计、统计
- Studio：Video、Agent、Radar

## 3. 目录分层

主目录结构如下：

- `web/src/app`
  页面路由和 API Route
- `web/src/features`
  业务域组件与 hooks
- `web/src/components`
  通用组件和部分 Studio 组件
- `web/src/lib`
  基础能力层，包括认证、HTTP、API 客户端、仓储等
- `web/src/lib/repositories`
  数据访问层
- `web/migrations`
  SQL migration
- `web/tests/e2e`
  Playwright 端到端测试
- `web/src/__tests__`
  Vitest 单元与 API 测试

## 4. 请求链路

典型链路如下：

1. 页面组件或业务 hook 调用 `/api/*`
2. API Route 负责鉴权、参数校验和响应包装
3. Route 调用 repository 或 service
4. repository 执行 PostgreSQL 查询
5. API 返回统一格式响应

客户端的目标状态是：

- 页面组件尽量不直接写 `fetch + useEffect`
- 数据请求优先收敛到 hook
- 通用请求逻辑通过 `api-client.ts`、TanStack Query 和业务 hooks 复用

## 5. 认证链路

当前认证采用 JWT。

关键文件：

- `web/src/app/api/login/route.ts`
- `web/src/app/api/register/route.ts`
- `web/src/app/api/logout/route.ts`
- `web/src/lib/auth-cookie.ts`
- `web/src/lib/http.ts`
- `web/middleware.ts`
- `web/src/app/providers.tsx`

当前规则：

- 登录和注册由服务端写入认证 cookie
- 注销由 `/api/logout` 清理认证 cookie
- 中间件优先从 `Authorization` 或 cookie 读取 token
- `AuthProvider` 仍保留本地 token/profile 存储，用于现有客户端请求兼容

当前状态不是纯服务端 session 模型，而是“服务端主导 cookie + 客户端保留 token 兼容层”。

## 6. 客户端数据获取约定

### 6.1 通用层

已有通用客户端请求和缓存能力：

- `web/src/lib/api-client.ts`
- `web/src/lib/api-client.ts`
- `web/src/lib/query-keys.ts`
- `web/src/components/QueryProvider.tsx`

约定：

- 能用 `api-client.ts` 的地方，不直接手写 `fetch` 解析成功失败结构
- 能复用 TanStack Query 的列表/元数据请求，不重复写 `useEffect + fetch + 自定义缓存`

### 6.2 当前已收敛的页面

博客域：

- 标签请求已收敛到 `web/src/features/blog/hooks/useTags.ts`
- 分类请求已收敛到 `web/src/features/blog/hooks/useCategories.ts`
- 发布页与博客页已复用上述 hooks

消息域：

- 会话列表：`web/src/features/messages/hooks/useConversations.ts`
- 通知列表：`web/src/features/messages/hooks/useNotifications.ts`
- 当前会话消息：`web/src/features/messages/hooks/useMessages.ts`
- 发送消息动作：`web/src/features/messages/hooks/useSendMessage.ts`

未完全收敛的复杂请求可以暂时保留业务专用 hook，例如：

- `web/src/features/blog/hooks/usePosts.ts`

## 7. Repository 分层约定

### 7.1 原则

repository 负责数据访问，不负责页面状态。

单个 repository 文件不应继续无限膨胀。当前已经开始按职责拆分实现文件，但保持原有导出入口不变。

### 7.2 已完成拆分

#### PostRepository

入口：

- `web/src/lib/repositories/post-repository.ts`

拆分为：

- `post-repository.content.ts`
  文章主流程、互动、收藏、活动流
- `post-repository.admin.ts`
  分类、友情链接、站点统计、后台文章管理
- `post-repository.types.ts`
  对外类型
- `post-repository.shared.ts`
  共享分页和 count 工具

#### VideoTaskRepository

入口：

- `web/src/lib/repositories/video-task-repository.ts`

拆分为：

- `video-task-repository.tasks.ts`
  视频任务、结果、用户任务统计
- `video-task-repository.studio.ts`
  角色、配置、历史、活跃任务、任务时间
- `video-task-repository.types.ts`
  对外类型
- `video-task-repository.shared.ts`
  分页工具

### 7.3 后续拆分原则

新拆分时遵循以下规则：

1. 外部导出入口尽量保持不变
2. 优先按职责域拆，而不是按 CRUD 动词拆
3. 共享类型和工具单独抽文件
4. 先保证行为不变，再讨论进一步抽象

## 8. 测试基线

### 8.1 Vitest

当前已补齐的核心 API 测试：

- 博客 API
- 消息 API
- Agent run API

测试位置：

- `web/src/__tests__/api/blog/route.test.ts`
- `web/src/__tests__/api/messages/route.test.ts`
- `web/src/__tests__/api/agent/run.route.test.ts`

### 8.2 Playwright

当前最小 smoke 基线：

- 注册并自动登录
- 发布文章
- 新建会话并发送私信

文件位置：

- `web/playwright.config.ts`
- `web/tests/e2e/app-smoke.spec.ts`

说明：

- Playwright 运行时会显式关闭 Turnstile
- Next.js 开发态已配置 `allowedDevOrigins: ["127.0.0.1"]`

## 9. CI 基线

GitHub Actions 工作流：

- `.github/workflows/web-ci.yml`

当前 CI 包含：

- `npm ci`
- 数据库迁移
- `npm run type-check`
- `npm run lint`
- `npm run test -- --run`
- `npm run test:e2e`

CI 使用 PostgreSQL service，并关闭 Turnstile。

## 10. 开发约定

### 10.1 新增页面数据请求

优先顺序：

1. 复用现有业务 hook
2. 复用 TanStack Query hooks 和 `queryKeys`
3. 最后才在页面里直接写 `fetch`

### 10.2 新增 API Route

要求：

- 使用统一响应格式
- 使用校验工具处理 body/query/params
- 鉴权逻辑优先收口到 `http.ts` / middleware / error-handler

### 10.3 新增 repository 方法

要求：

- 尽量放在已有职责文件内
- 如果继续膨胀，先拆分再加方法
- 不把页面逻辑、提示文案、缓存逻辑塞进 repository

### 10.4 新增测试

最低要求：

- 核心新 API 需要 Vitest 覆盖
- 关键用户链路变更需要考虑是否补 Playwright smoke

## 11. 当前遗留问题

目前仍未完全解决的问题包括：

- `AuthProvider` 仍依赖本地 token/profile 兼容层
- 部分页面仍存在直接 `fetch` 和本地请求状态管理
- repository 拆分刚起步，尚未覆盖所有大文件
- 项目中文文案和编码链路仍需统一排查

## 12. 推荐下一步

建议后续按以下顺序继续推进：

1. 继续补架构文档和 API 文档
2. 逐步减少客户端对 `localStorage token` 的依赖
3. 继续收敛剩余页面的数据请求模式
4. 继续拆分其他超长 repository 和复杂 service
5. 扩展 Playwright 用例到后台和 Studio
