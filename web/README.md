这是一个基于 [Next.js](https://nextjs.org) 的项目。

## 数据库

项目已统一使用 PostgreSQL，不再依赖 SQLite。

请在 `web/.env.local` 中配置：

```bash
DATABASE_URL=postgres://postgres:你的密码@127.0.0.1:5432/witweb
PG_POOL_MAX=10
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECTION_TIMEOUT_MS=5000
PG_SSL=false
```

健康检查接口：`/api/health`

## 数据库迁移

```bash
npm run db:migrate:status
npm run db:migrate
```

- `db:migrate:status`：查看迁移状态（已执行 / 待执行）
- `db:migrate`：按文件名顺序执行 `migrations/*.sql`
- 同名迁移文件若内容被修改，会触发 checksum 校验失败，防止历史迁移被悄悄篡改
- `002_seed_system_users.sql` 会确保 `witw`（管理员）和 `WitAI`（机器人）存在
  首次初始化的 `witw` 默认密码为 `witw`，请上线前立即修改

## 旧 SQLite 数据迁移到 PostgreSQL

```bash
npm run data:migrate
```

默认读取 `../data` 目录下的 4 个文件：

- `users.db`
- `blog.db`
- `studio.db`
- `messages.db`

可指定目录：

```bash
python scripts/migrate-sqlite-to-postgres.py --data-dir D:\path\to\data
```

说明：

- 默认会先清空 PostgreSQL 业务表再导入（`TRUNCATE ... RESTART IDENTITY CASCADE`）
- 若你要保留现有数据并做增量导入，可加 `--keep-existing`
- 执行前需确保 `DATABASE_URL` 正确，且 `psql` 已在 PATH

## Turnstile 人机验证（可选）

登录/注册已支持 Cloudflare Turnstile。开启方式：

```bash
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=你的服务端密钥
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的站点密钥
NEXT_PUBLIC_TURNSTILE_ENABLED=true
```

## 快速开始

```bash
npm install
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

## 常用命令

```bash
npm run dev            # 开发
npm run build          # 构建
npm run start          # 启动生产服务
npm run lint           # 代码检查
npm run type-check     # TypeScript 检查
npm run test           # 单元测试
npm run test:coverage  # 测试覆盖率
npm run db:migrate     # 执行数据库迁移
```

## 参考资料

- [Next.js 文档](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
