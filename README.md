# WitWeb (Sora2 Web Studio)

基于 Next.js App Router 的单体 Web 应用，内置多模块内容、用户和创作管理能力，数据存储使用本地 SQLite。应用入口与 API 均在 `web/` 中完成，启动后会自动在 `data/` 下创建数据库与配置文件。

## 功能概览

- 统一的 Web 前端与 API 路由（Next.js App Router）
- 本地 SQLite 数据库（用户、博客、消息、创作等）
- 支持管理端配置 API Token / Base URL / Sora2 Key
- 支持上传文件，生成内容后管理历史记录

## 技术栈

- Next.js 16 / React 19
- TypeScript
- Tailwind CSS 4
- SQLite（better-sqlite3）

## 目录结构

```
.
├── web/                 # Next.js 应用与 API 路由
├── scripts/             # 本地脚本（如 DB 检查）
├── deployment/          # 部署相关资源
├── tools/               # 辅助工具
├── uploads/             # 上传文件目录（运行时生成）
├── debug_db.py          # 数据库调试脚本
├── schema.txt           # DB schema 说明
└── schema_dump.txt      # DB schema 导出
```

## 本地开发

```bash
cd web
npm install
npm run dev
```

访问：http://localhost:3000

### 常用脚本

```bash
npm run build
npm run start
npm run lint
```

## 数据与配置

默认情况下会在项目根目录下创建 `data/` 目录，包含：

- `users.db` 用户数据
- `blog.db` 内容与评论数据
- `studio.db` 创作/任务数据
- `messages.db` 消息/私信数据
- `api_config.json` 第三方 API 配置

可通过环境变量指定数据库路径：

```
SORA_USERS_DB_PATH=ABSOLUTE_PATH
SORA_BLOG_DB_PATH=ABSOLUTE_PATH
SORA_STUDIO_DB_PATH=ABSOLUTE_PATH
SORA_MESSAGES_DB_PATH=ABSOLUTE_PATH
```

### 关键环境变量

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：管理账号初始化信息
- `NEXT_PUBLIC_ADMIN_USERNAME`：前端展示的管理员用户名
- `AUTH_SECRET`：鉴权签名密钥（默认 `change-this-secret`，建议本地/生产自行设置）

## 其他说明

- 应用使用本地 SQLite，首次运行会自动创建缺失的表结构与默认管理员账号。
- 上传文件会保存在根目录 `uploads/` 下。
