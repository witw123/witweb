# 状态管理迁移进度

## 已完成

### 基础设施

- `web/src/components/QueryProvider.tsx`
- `web/src/lib/query-keys.ts`

### 博客读链路

- `useCategories`
- `useTags`
- `usePosts`
- `BlogPostPage`
- `FavoritesPage`

### 博客写链路

- `usePublishPost`
- `useSubmitComment`
- `useCommentActions`

### 消息读链路

- `useConversations`
- `useNotifications`
- `useMessages`

### 消息写链路

- `useSendMessage`

### Agent 读链路

- `AgentTaskList`
- `AgentGallery`
- `useAgentRunDetail`

### Agent 写链路

- `useCreateAgentRun`
- `useContinueAgentRun`
- `useAgentPing`
- `AgentCreate`

### Video 读链路

- `TaskList`
- `Gallery`
- `SettingsPanel`
- `useVideoOutputs`

### Video 写链路

- `CreateForm`
- `CharacterLab`
- `SettingsPanel`
- `useVideoOutputs` 删除产物
- `TaskList` 落盘到作品库

### Radar 读链路

- `useRadarSources`
- `useRadarItems`
- `useRadarTopics`
- `RadarLayout`

### Radar 写链路

- 来源创建 / 更新 / 删除
- 立即抓取
- 热点清空
- AI 分析
- 选题保存 / 删除

## 当前策略

迁移顺序保持为：

1. 先统一读接口
2. 再迁核心 mutation
3. 最后只在纯客户端状态确实需要时再评估 Zustand

## 已完成的 mutation

- 发送消息
- 发布文章
- 发表评论
- 评论点赞 / 点踩 / 编辑 / 删除
- Agent 流式创建 run
- Agent 继续优化
- Agent Ping 检测
- Agent 任务删除
- Video 配置保存
- Video 任务创建
- Video 角色创建 / 上传
- Video 本地产物删除
- Video 成功任务落盘到作品库
- 图片上传客户端工具已统一到 `upload-image-client`
- Radar 来源创建 / 更新 / 删除
- Radar 立即抓取
- Radar 热点清空
- Radar AI 分析
- Radar 选题保存 / 删除

这些 mutation 现在统一为：

- `useMutation` 或专用异步 hook
- 按资源失效相关 query
- 保留原有页面提示和交互行为

## 仍未迁移的高优先级链路

- 图片上传主路径已统一到 `/api/v1/upload/image`
- 其余低频页面仍有零散本地异步状态，可按需再收口

## 原则

- 优先收敛服务端状态
- 优先迁移高频、低风险、可验证链路
- 不为了“全局状态”继续把服务端数据堆回 Zustand
- 对外组件接口尽量保持稳定
