这是一个基于 [Next.js](https://nextjs.org) 的项目。

## 数据库

项目已接入 PostgreSQL 连接能力，可通过以下环境变量配置：

```bash
DATABASE_URL=D:\code\witweb\web_data
PG_POOL_MAX=10
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECTION_TIMEOUT_MS=5000
PG_SSL=false
```

当前业务查询仍默认使用 SQLite，PostgreSQL 健康状态已接入 `/api/health`，用于分阶段迁移。

### SQLite 数据迁移到 PostgreSQL

```bash
npm run migrate:postgres
```

说明：
- 执行前必须先设置 `DATABASE_URL`。
- 脚本使用 `ON CONFLICT DO NOTHING`，可重复执行。
- 默认 SQLite 数据源路径：
  - `../data/users.db`
  - `../data/blog.db`
  - `../data/studio.db`
  - `../data/messages.db`

## 快速开始

先启动开发服务器：

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

你可以从修改 `app/page.tsx` 开始，页面会自动热更新。

## 常用命令

```bash
npm run dev            # 开发
npm run build          # 构建
npm run start          # 启动生产服务
npm run lint           # 代码检查
npm run type-check     # TypeScript 检查
npm run test           # 单元测试
npm run test:coverage  # 测试覆盖率
```

## 参考资料

- [Next.js 文档](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
