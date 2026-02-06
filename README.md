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
ADMIN_USERNAME=your_admin_username
```

## 安全配置

### 环境变量

复制 `.env.example` 到 `.env.local` 并配置：

```bash
# 必需：JWT 签名密钥（至少 32 字符）
AUTH_SECRET=your-secret-key-here

# 必需：加密密钥（用于敏感数据存储）
ENCRYPTION_KEY=your-encryption-key-here

# API 密钥（替代 data/api_config.json）
SORA2_API_KEY=your-sora2-api-key
GRSAI_TOKEN=your-grsai-token

# 管理员用户名
ADMIN_USERNAME=admin
```

生成安全密钥：

```bash
node scripts/generate-keys.js
```

### 安全优化

详细的安全修复文档：`docs/SECURITY_FIXES.md`

主要改进：
1. ✅ API 密钥从环境变量读取（替代硬编码）
2. ✅ SQL 注入防护加固
3. ✅ 输入验证中间件
4. ✅ 敏感数据加密存储
5. ✅ 速率限制
6. ✅ 安全响应头

## 说明

- 旧版 AI 管理面板与相关 API 已移除。
- Studio 相关接口统一在 `/api/video/*`。
- `sketch2cad` 模块已移除。
- **注意**：`data/api_config.json` 已被弃用，请使用环境变量配置 API 密钥。
