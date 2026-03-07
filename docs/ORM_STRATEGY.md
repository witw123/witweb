# ORM 引入策略

## 结论

当前项目已选择 **Drizzle ORM** 作为渐进式类型化数据访问层，而不是一次性迁到 Prisma。

原因：
- 现有仓库已经有大量手写 SQL 和 repository 逻辑
- 项目已经有稳定的 SQL migration 体系：`web/migrations/*.sql`
- 一次性切到重 ORM 的风险和改造成本过高

Drizzle 更适合当前阶段，因为它可以：
- 提供 schema 驱动的类型推导
- 保持对 SQL 和现有仓储模式的控制力
- 允许按模块渐进迁移，而不是全仓重写

## 当前落地情况

已接入的基础设施：
- `web/drizzle.config.ts`
- `web/src/lib/db/schema.ts`
- `web/src/lib/db/drizzle.ts`

已开始迁移的仓储方向：
- 分类与标签读链路
- 用户关系
- 评论主链路
- 消息读链路
- Agent 读链路
- Radar 读链路

当前对外入口应以 `v1` 路径为准，例如：
- `GET /api/v1/categories`
- `GET /api/v1/tags`

## 迁移策略

数据库迁移仍以现有 SQL migration 为准：
- migration 文件继续放在 `web/migrations/*.sql`
- 执行入口继续使用 `web/scripts/db-migrate.mjs`
- Drizzle 当前主要负责 schema、类型推导和渐进式查询接入

这样做的原因：
- 避免同时维护两套 migration 真源
- 不打断现有部署与 CI 流程
- 降低 ORM 引入的初始风险

## 推荐顺序

1. 先迁低风险、读多写少的仓储
2. 再迁列表、筛选、分页这类查询
3. 测试覆盖足够后，再迁简单写操作
4. 事务复杂、跨表副作用多的写链路继续保留手写 SQL，后续再评估

## 当前优先适合迁移的模块

- 用户资料与关系查询
- 评论读取与基础操作
- 消息列表与会话读取
- Agent / Radar 的读侧能力

## 暂不建议优先迁移的模块

- 复杂事务写链路
- 视频任务完整生命周期
- 文章内容域的大型聚合查询

## 维护约定

- 不一次性全量替换现有 repository
- 新模块优先考虑 Drizzle
- 老模块按“低风险、可验证、可回退”的原则逐步迁移
- 复杂查询允许继续保留手写 SQL

## 一句话原则

引入 ORM 的目标不是立刻消灭所有 SQL，而是先获得更强的类型安全和更低的重构成本，再逐步收口数据访问层。
