# Repository 层说明

本目录是 WitWeb 的数据访问层，已统一为 PostgreSQL 实现，不再使用 SQLite。

## 目标

- 业务与 SQL 解耦
- 统一错误处理
- 统一分页与返回结构
- 降低路由层复杂度

## 目录结构

```text
web/src/lib/repositories/
├── index.ts
├── types.ts
├── user-repository.ts
├── post-repository.ts
├── comment-repository.ts
├── message-repository.ts
├── video-task-repository.ts
├── agent-repository.ts
├── topic-radar-repository.ts
└── secure-config-repository.ts
```

## 使用方式

```ts
import { postRepository } from "@/lib/repositories";

const post = await postRepository.getPostDetail("hello-world", "alice");
```

## 事务

事务通过 `withPgTransaction` 实现，示例：

```ts
import { withPgTransaction, pgRun } from "@/lib/postgres-query";

await withPgTransaction(async (client) => {
  await pgRun("UPDATE users SET balance = balance - ? WHERE username = ?", [10, "alice"], client);
  await pgRun("UPDATE users SET balance = balance + ? WHERE username = ?", [10, "bob"], client);
});
```

## 约定

- 所有仓储方法使用 `async/await`
- SQL 参数统一使用 `?` 占位（由 `postgres-query` 转换）
- 统一抛出 `ApiError` 或明确业务错误
- 路由层只负责鉴权、校验、编排，不直接写 SQL

## 变更说明

- 已移除 `base-repository.ts`
- 已移除 `@/lib/db` / `db-init` / `db-manager` / `db-transaction`
- 分页类型统一在 `types.ts` 中维护
