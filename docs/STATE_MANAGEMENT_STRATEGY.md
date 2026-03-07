# 状态管理策略

## 结论

当前项目的状态管理优化，优先选择：

1. 引入 TanStack Query 统一服务端状态
2. 按需引入 Zustand 管理纯客户端状态
3. 不建议把两者混用到同一类问题上

这意味着：

- 列表、详情、分页、轮询、缓存、失效，优先交给 TanStack Query
- 面板开关、临时筛选、纯前端草稿、跨组件 UI 状态，才考虑 Zustand

## 为什么先选 TanStack Query

这个项目当前最明显的问题不是“缺一个全局状态库”，而是“服务端数据获取方式不统一”。

目前仓库里已经存在这些问题：

- 大量 `fetch + useEffect + useState`
- 自定义缓存工具并存
- 请求轮询逻辑分散
- mutation 后靠事件或手动刷新同步数据
- 加载中、失败、重试状态在各页面重复实现

TanStack Query 能直接解决这些问题：

- 缓存
- 去重
- 自动失效
- 重试
- 轮询
- 查询状态统一
- mutation 后刷新相关查询

## 为什么暂不优先引入 Zustand

Zustand 本身没有问题，但它解决的是另一类问题。

它更适合：

- UI 面板状态
- 当前选中的 tab / filter
- 临时表单草稿
- 不需要和服务端直接同步的前端状态

它不适合直接承担以下职责：

- 服务端列表缓存
- 详情页缓存
- 分页数据管理
- 轮询与重试
- 请求失效控制

如果现在先用 Zustand 去承接这些服务端状态，只会把已有的分散逻辑换一种方式继续分散。

## 当前落地进度

项目已经接入了 TanStack Query 基础设施：

- `web/src/components/QueryProvider.tsx`
- `web/src/lib/query-keys.ts`

当前已迁移的读链路包括：

- 分类：`web/src/features/blog/hooks/useCategories.ts`
- 标签：`web/src/features/blog/hooks/useTags.ts`
- 会话列表：`web/src/features/messages/hooks/useConversations.ts`
- 通知列表：`web/src/features/messages/hooks/useNotifications.ts`
- 当前会话消息：`web/src/features/messages/hooks/useMessages.ts`

## 推荐的后续迁移顺序

### 第一批：继续迁移读接口

优先处理：

- Agent run 列表
- Agent run 详情
- Video 任务列表
- Video 配置读取
- 博客详情页评论列表

### 第二批：开始迁移 mutation

优先处理：

- 发送消息
- 发表评论
- 发布文章
- Agent 创建 run

迁移方式应为：

- 使用 `useMutation`
- 使用 `invalidateQueries`
- 逐步移除手动事件刷新逻辑

当前已完成：

- 消息发送已迁移为 `useMutation + invalidateQueries`

### 第三批：再评估 Zustand

只有当以下状态明显开始散落时，再引入 Zustand：

- Studio 面板/工具条状态
- 复杂多步骤表单草稿
- 与服务端无关的本地编辑器状态

## Query Key 约定

当前建议统一将服务端状态按资源命名：

- `categories`
- `tags`
- `message-conversations`
- `message-notifications`
- `message-messages`
- `agent-runs`

后续新增资源时，应继续沿用这种命名方式，避免 query key 随页面结构变化而漂移。

## 实施原则

- 不一次性全量替换现有 hooks
- 优先迁移低风险读接口
- 保持现有组件对外接口尽量不变
- 每迁移一批，就做类型检查和最小回归验证

## 一句话原则

当前项目的状态管理优化重点，不是先找一个“全局状态库”，而是先把服务端状态管理统一起来。
