# WitWeb

基于 Next.js App Router 的单体应用，包含：
- 博客与互动（文章、评论、点赞、收藏、关注）
- 私信消息
- 管理后台（用户/文章/友链）
- Studio 视频任务（创建、查询、历史、配置）

数据使用本地 SQLite。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- better-sqlite3

## 目录结构

```text
.
├─ web/                        # Next.js 主应用
│  ├─ src/
│  │  ├─ app/                  # 页面路由 + API 路由
│  │  │  ├─ api/               # /api/*
│  │  │  │  ├─ admin/*         # 管理后台 API
│  │  │  │  └─ video/*         # Studio 视频 API
│  │  │  └─ admin/*            # 管理后台页面
│  │  ├─ features/             # 业务组件（按域拆分）
│  │  │  ├─ admin/
│  │  │  ├─ blog/
│  │  │  ├─ user/
│  │  │  ├─ messages/
│  │  │  ├─ friends/
│  │  │  └─ auth/
│  │  ├─ lib/                  # 服务端业务与数据访问封装
│  │  ├─ components/           # 通用组件 + studio 组件
│  │  ├─ styles/               # 全局样式
│  │  └─ utils/                # 工具函数
│  └─ package.json
├─ data/                       # SQLite 数据文件
├─ uploads/                    # 上传文件
├─ downloads/                  # 生成视频文件（运行时创建）
└─ README.md
```

## 本地开发

```bash
cd web
npm install
npm run dev
```

访问：`http://localhost:3000`

## 构建与运行

```bash
cd web
npm run build
npm run start
```

## 数据库与环境变量

默认数据库文件：
- `data/users.db`
- `data/blog.db`
- `data/studio.db`
- `data/messages.db`

可选覆盖路径（绝对路径）：

```bash
SORA_USERS_DB_PATH=ABSOLUTE_PATH
SORA_BLOG_DB_PATH=ABSOLUTE_PATH
SORA_STUDIO_DB_PATH=ABSOLUTE_PATH
SORA_MESSAGES_DB_PATH=ABSOLUTE_PATH
```

## 管理后台

- 管理页面：`/admin`
- 管理账号名默认值：`witw`
- 可通过环境变量覆盖：

```bash
NEXT_PUBLIC_ADMIN_USERNAME=your_admin_username
```

## 说明

- 旧版 AI 管理面板与相关 API 已移除。
- Studio 相关接口统一在 `/api/video/*`。
- `sketch2cad` 模块已移除。
