# Drizzle 迁移清单

## 当前状态

项目已经从“接入 Drizzle 基础设施”进入“按业务域迁移读链路，并开始试点轻量写链路”的阶段。

已完成基础设施：
- `web/drizzle.config.ts`
- `web/src/lib/db/drizzle.ts`
- `web/src/lib/db/schema.ts`

已落地的 Drizzle 仓储：
- `category-repository.drizzle.ts`
- `user-repository.drizzle.ts`
- `comment-repository.drizzle.ts`
- `message-repository.drizzle.ts`
- `agent-repository.drizzle.ts`
- `topic-radar-repository.drizzle.ts`
- `post-repository.drizzle.ts`

## 已迁移的业务域

### 分类与发现
- 分类列表
- 标签统计相关读取

### 用户关系
- 查用户
- 用户是否存在
- 基础用户批量读取
- 关注数统计
- 是否关注
- 关注 / 取关
- 粉丝列表
- 关注列表

### 评论
- 按文章读取评论
- 单条评论读取
- 创建评论
- 编辑评论
- 删除评论
- 评论投票

### 消息
- 会话列表
- 会话详情读取
- 会话消息读取与已读更新

### Agent
- run 列表
- run 详情
- steps / artifacts 读取
- 最新 artifact / 指定 artifact 内容读取

### Radar
- 来源列表
- 热点列表
- 已保存选题列表
- 通知列表
- 规则列表
- 日志列表

### Post
- 文章列表
- 文章详情
- 收藏列表
- sitemap 列表
- 用户活动与点赞统计
- 浏览计数写入
- 点赞 / 点踩切换
- 收藏切换

## 迁移原则

1. 先迁读多写少、结构清晰的查询。
2. 先迁真实高频调用点，不做无人使用的平行仓储。
3. SQL migration 继续保留为唯一迁移真源。
4. 复杂事务和强副作用写链路可以继续保留原生 SQL。

## 当前仍建议优先迁移的部分

### Post 剩余写链路
- `create`
- `updateBySlug`
- `hardDelete`

### 仍未迁移的复杂写链路
- 视频任务完整生命周期
- Agent 写入事务
- Radar 抓取 / 分析 / 通知分发

## 暂不建议急迁的部分

- 后台重度聚合统计
- 动态 SQL 很重的后台筛选
- 强依赖事务和跨表副作用的批量操作

## 下一步建议

1. 继续观察 `post` 轻量写链路在真实 API 上的稳定性。
2. 下一批可评估：`create` 或 `updateBySlug`，但不建议一次迁 `hardDelete`。
3. `video-task-repository` 仍保持保守推进，优先读侧基础查询。
