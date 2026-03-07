# WitWeb

WitWeb 是一个基于 Next.js App Router 的全栈社区站点，包含：
- 博客（发布、分类、评论、点赞/收藏）
- 用户关系（关注/粉丝、个人主页）
- 私信系统
- 管理后台
- Studio（Video、Agent、Radar）

## 技术栈

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Vitest（单元测试）

## 仓库结构

```text
.
├─ web/          # 主应用（Next.js）
├─ data/         # 历史 SQLite 数据目录（用于迁移）
├─ uploads/      # 上传目录
├─ web_data/     # 运行数据目录（按本地环境使用）
├─ docs/         # 项目文档（如安全修复说明）
├─ deployment/   # 部署相关配置（如 livekit）
└─ scripts/      # 仓库级脚本
```

## 快速开始（本地开发）

### 1. 环境要求

- Node.js 20+
- PostgreSQL 14+

### 2. 安装依赖

```bash
cd web
npm install
```

### 3. 配置环境变量

创建 `web/.env.local`：

```env
NODE_ENV=development
APP_URL=http://localhost:3000

DATABASE_URL=postgres://postgres:your_password@127.0.0.1:5432/witweb
PG_POOL_MAX=10
PG_IDLE_TIMEOUT_MS=30000
PG_CONNECTION_TIMEOUT_MS=5000
PG_SSL=false

AUTH_SECRET=replace_with_at_least_32_chars
ENCRYPTION_KEY=replace_with_at_least_32_chars
```

可选（启用 Turnstile）：

```env
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=your_secret_key
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
NEXT_PUBLIC_TURNSTILE_ENABLED=true
```

### 4. 数据库迁移

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:drizzle:generate
npm run db:drizzle:studio
```

### 5. 启动开发服务

```bash
npm run dev
```

访问：`http://localhost:3000`

健康检查：`/api/health`

## 旧数据迁移（SQLite -> PostgreSQL）

如果你有旧版 SQLite 数据（`data/users.db`、`blog.db`、`studio.db`、`messages.db`）：

```bash
cd web
npm run data:migrate
```

指定数据目录：

```bash
python scripts/migrate-sqlite-to-postgres.py --data-dir D:\path\to\data
```

说明：
- 默认会先清空目标业务表再导入。
- 如需保留现有数据，使用 `--keep-existing`。

## 常用命令

```bash
cd web
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run db:migrate:status
npm run db:migrate
```

## 生产部署（Ubuntu）

### 1. 安装基础依赖

```bash
sudo apt update
sudo apt install -y git curl build-essential nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. 创建数据库

```bash
sudo -u postgres psql -c "CREATE DATABASE witweb;"
sudo -u postgres psql -c "CREATE USER witweb WITH PASSWORD 'StrongPasswordHere';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE witweb TO witweb;"
```

### 3. 拉取代码并构建

```bash
cd /var/www
sudo git clone <your-repo-url> witweb
sudo chown -R $USER:$USER /var/www/witweb
cd /var/www/witweb/web
npm install
npm run db:migrate
npm run build
```

### 4. 生产环境变量

`/var/www/witweb/web/.env.local` 至少包含：

```env
NODE_ENV=production
APP_URL=https://your-domain.com
DATABASE_URL=postgres://witweb:StrongPasswordHere@127.0.0.1:5432/witweb
AUTH_SECRET=replace_with_at_least_32_chars
ENCRYPTION_KEY=replace_with_at_least_32_chars
```

### 5. systemd 守护进程

`/etc/systemd/system/witweb.service`：

```ini
[Unit]
Description=WitWeb Next.js Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/witweb/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo chown -R www-data:www-data /var/www/witweb
sudo systemctl daemon-reload
sudo systemctl enable witweb
sudo systemctl start witweb
sudo systemctl status witweb
```

### 6. Nginx 反向代理

`/etc/nginx/sites-available/witweb`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/witweb /etc/nginx/sites-enabled/witweb
sudo nginx -t
sudo systemctl reload nginx
```

### 7. HTTPS（推荐）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 安全与文档

- 安全修复与配置建议：`docs/SECURITY_FIXES.md`
- API 参考：`docs/API_REFERENCE.md`
- API 版本控制：`docs/API_VERSIONING.md`
- API 弃用清单：`docs/API_DEPRECATION_TRACKER.md`
- 架构与开发工作流：`docs/ARCHITECTURE_AND_WORKFLOW.md`
- 项目评估与迭代路线：`docs/PROJECT_ASSESSMENT_AND_ROADMAP.md`
- ORM 引入策略：`docs/ORM_STRATEGY.md`
- 状态管理策略：`docs/STATE_MANAGEMENT_STRATEGY.md`
- 状态管理迁移进度：`docs/STATE_MANAGEMENT_PROGRESS.md`
- `AUTH_SECRET`、`ENCRYPTION_KEY` 在生产环境必须配置且足够强。
- 不要提交 `.env.local`。
