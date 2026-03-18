# API 版本控制与路由收敛

## 当前策略

项目当前默认 API 版本为 `v1`，采用“兼容式版本化”：

- 现有 `/api/*` 路径继续保留，避免一次性中断历史调用
- 新增 `/api/v1/*` 作为稳定版本入口
- 旧路由与新路由尽量复用同一套 handler 或共享逻辑

目标是：

- 不打断现有前端功能
- 给后续接口演进预留稳定入口
- 逐步把重复路由收敛到统一实现

## 已完成的路由收敛

### Messages

- 旧路径：`/api/messages/conversations`、`/api/messages/send`
- 统一入口：`GET /api/messages`、`POST /api/messages`
- `v1` 入口：
  - `/api/v1/messages`
  - `/api/v1/messages/[conversationId]`
  - `/api/v1/messages/notifications`
  - `/api/v1/messages/read-notifications`
  - `/api/v1/messages/unread`

### Video

- 配置入口：
  - `/api/v1/video/config`
- 任务与结果入口：
  - `/api/v1/video/tasks`
  - `/api/v1/video/tasks/[id]`
  - `/api/v1/video/generate`
  - `/api/v1/video/result`
  - `/api/v1/video/history`
  - `/api/v1/video/active`
  - `/api/v1/video/active/remove`
- 角色入口：
  - `/api/v1/video/characters`
  - `/api/v1/video/create-character`
  - `/api/v1/video/upload-character`

### Agent

- `/api/v1/agent/ping`
- `/api/v1/agent/conversations`
- `/api/v1/agent/conversations/[id]`
- `/api/v1/agent/conversations/[id]/messages`
- `/api/v1/agent/conversations/[id]/messages/stream`
- `/api/v1/agent/conversations/by-goal/[goalId]`
- `/api/v1/agent/goals`
- `/api/v1/agent/goals/[id]/timeline`
- `/api/v1/agent/goals/[id]/execute`
- `/api/v1/agent/goals/[id]/execute/stream`
- `/api/v1/agent/approvals/[id]/approve`
- `/api/v1/agent/approvals/[id]/reject`
- `/api/v1/agent/tools`

### Blog

- `/api/v1/blog`
- `/api/v1/blog/[slug]`
- `/api/v1/blog/[slug]/comments`
- `/api/v1/blog/[slug]/view`
- `/api/v1/blog/[slug]/like`
- `/api/v1/blog/[slug]/dislike`
- `/api/v1/blog/[slug]/favorite`

### Radar

- `/api/v1/radar/sources`
- `/api/v1/radar/sources/[id]`
- `/api/v1/radar/items`
- `/api/v1/radar/topics`
- `/api/v1/radar/topics/[id]`
- `/api/v1/radar/fetch`
- `/api/v1/radar/analyze`

### User And Social

- `/api/v1/profile`
- `/api/v1/follow`
- `/api/v1/follow/[username]`
- `/api/v1/followers`
- `/api/v1/following`
- `/api/v1/users/[username]/profile`
- `/api/v1/users/[username]/activity`

### Site And Public

- `/api/v1/categories`
- `/api/v1/tags`
- `/api/v1/friend-links`
- `/api/v1/friend-links/[id]`
- `/api/v1/about`
- `/api/v1/stats`
- `/api/v1/track-visit`

### Admin Stats

- `/api/v1/admin/stats`
- `/api/v1/admin/stats/overview`
- `/api/v1/admin/stats/trends`

## 前端调用约定

- 新增前端请求时，优先使用 `getVersionedApiPath()` 生成 `/api/v1/*` 路径
- 已完成版本化的模块，逐步把旧 `/api/*` 请求切换到 `v1`
- 旧 `/api/*` 路径只作为兼容层保留，不再新增依赖

## 已切换到 v1 的前端调用

- 消息模块：会话列表、会话消息、通知、发送消息、未读数
- 博客模块：分类、标签、文章列表、文章详情、评论、浏览计数、点赞/点踩/收藏、发布文章
- 后台模块：仪表盘统计、管理员登录后的统计探活
- Agent 模块：创建 run、任务列表、画廊与详情相关页面
- 视频模块：配置读取与保存、任务列表、任务详情、角色任务创建、视频生成
- Radar 模块：来源管理、热点列表、AI 分析、选题库
- 用户关系模块：个人资料、用户主页、关注 / 粉丝 / 动态列表
- 站点公共模块：友链、关于页、底部统计、访问记录

## 设计原则

1. 先抽共享 handler，再暴露版本路径。
2. 默认新接口优先挂到 `/api/v1/*`。
3. 旧接口保留兼容层，不立即删除。
4. 只有在响应结构或语义变化时，才新增 `v2`。

## 不建议的做法

- 复制一份新路由，但不复用旧逻辑
- 一次性把全部调用硬切到新路径
- 在没有协议变化时随意增加新版本号

## 下一步建议

1. 继续清理 `video` 剩余零散旧调用
2. 在发布说明里明确弃用接口的 `Sunset` 日期
3. 逐步为兼容层补测试，确保弃用阶段不回归
