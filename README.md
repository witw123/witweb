# WitWeb

WitWeb 是一个基于 Next.js App Router 的全栈社区站点，包含博客、互动、私信、后台管理和 Studio 视频任务能力。

## 功能概览

- 博客系统：文章发布、详情、评论、点赞/点踩、收藏、标签与分类
- 社交互动：关注/粉丝、个人资料页、访客统计
- 私信系统：会话列表、未读通知、消息收发
- 管理后台：用户、文章、分类、友链管理与安全配置
- Studio：视频任务创建、进度查询、历史记录、角色素材管理

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- SQLite（better-sqlite3）
- Vitest + Testing Library

## 目录结构

```text
.
├─ web/                     # 主应用（Next.js）
│  ├─ src/app/              # 页面路由与 API 路由
│  ├─ src/features/         # 按业务划分的功能模块
│  ├─ src/components/       # 通用组件与 Studio 组件
│  ├─ src/lib/              # 服务端逻辑、数据库与安全封装
│  └─ scripts/              # 站点数据迁移脚本
├─ data/                    # SQLite 数据库文件目录
├─ uploads/                 # 上传文件目录
├─ docs/                    # 项目文档（含安全修复说明）
├─ deployment/              # 部署相关配置
└─ scripts/                 # 根级工具脚本
```

## 环境要求

- Node.js 20+
- npm 10+
- Windows / macOS / Linux（均可）

## 快速启动

```bash
cd web
npm install
npm run dev
```

启动后访问：`http://localhost:3000`

## 构建与生产运行

```bash
cd web
npm run build
npm run start
```

## 常用命令

```bash
cd web
npm run lint
npm run test
npm run test:coverage
npm run type-check
```

## 环境变量

项目未内置 `.env.example`，可在 `web/.env.local` 中按需配置：

```bash
# 应用基础
NODE_ENV=development
APP_NAME=WitWeb
APP_URL=http://localhost:3000

# 认证与管理员
AUTH_SECRET=replace-with-a-random-string-at-least-32-chars
AUTH_EXPIRES_IN=1d
ADMIN_USERNAME=witw
ADMIN_PASSWORD=witw

# 加密
ENCRYPTION_KEY=replace-with-a-random-string

# 数据库路径（可选，不填则使用 ../data/*.db）
SORA_USERS_DB_PATH=
SORA_BLOG_DB_PATH=
SORA_STUDIO_DB_PATH=
SORA_MESSAGES_DB_PATH=

# 外部视频能力（按需）
SORA2_API_KEY=
SORA2_BASE_URL=https://api.sora2.example.com
GRSAI_TOKEN=
GRSAI_DOMESTIC_URL=https://grsai.dakka.com.cn
GRSAI_OVERSEAS_URL=https://grsaiapi.com
GRSAI_HOST_MODE=auto

# 安全/限流（可选）
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=60
LOGIN_RATE_LIMIT_MAX=5
CORS_ENABLED=false
CORS_ORIGIN=http://localhost:3000
CSP_ENABLED=true
```

说明：
- 未显式配置数据库路径时，会默认读取/创建 `data/users.db`、`data/blog.db`、`data/studio.db`、`data/messages.db`。
- 首次触发后端 API 时会自动初始化数据库表。
- 默认管理员账号来自 `ADMIN_USERNAME`，默认密码来自 `ADMIN_PASSWORD`（未设置时为 `witw`）。

## 数据库与迁移脚本

根目录提供了 Python 工具脚本：

```bash
python tools/init_split_db.py        # 初始化分库表结构
python tools/migrate_split_db.py     # 旧库迁移到分库
python tools/verify_split_db.py      # 校验迁移结果
```

安全与密钥辅助脚本：

```bash
node scripts/generate-keys.js        # 生成 AUTH_SECRET / ENCRYPTION_KEY
node scripts/migrate-api-keys.js     # 迁移旧版 API key 配置
```

## 接口健康检查

- `GET /api/health`

返回示例：

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-02-07T00:00:00.000Z"
  }
}
```

## 部署说明

- LiveKit 相关部署文件位于：`deployment/livekit/`
- 若需要容器化部署，可参考：`deployment/livekit/docker-compose.yml`

## 安全文档

详细安全修复说明见：`docs/SECURITY_FIXES.md`

## 备注

- `web/README.md` 仍是 Next.js 默认模板，项目主文档请以根目录 `README.md` 为准。
