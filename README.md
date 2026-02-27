# WitWeb

WitWeb 是一个基于 Next.js App Router 的全栈站点，包含博客、私信、管理后台和 Studio 模块。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- PostgreSQL

## 项目结构

```text
.
├─ web/          # 主应用（Next.js）
├─ data/         # 历史 SQLite 数据目录（用于迁移）
├─ uploads/      # 上传目录
├─ docs/         # 文档
└─ deployment/   # 部署相关配置
```

## 本地启动

```bash
cd web
npm install
npm run db:migrate
npm run dev
```

## Ubuntu 部署（生产）

### 1. 安装依赖

```bash
sudo apt update
sudo apt install -y git curl build-essential nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2. 创建 PostgreSQL 数据库

```bash
sudo -u postgres psql -c "CREATE DATABASE witweb;"
sudo -u postgres psql -c "CREATE USER witweb WITH PASSWORD 'StrongPasswordHere';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE witweb TO witweb;"
```

### 3. 拉取代码并安装

```bash
cd /var/www
sudo git clone <你的仓库地址> witweb
sudo chown -R $USER:$USER /var/www/witweb
cd /var/www/witweb/web
npm install
```

### 4. 配置环境变量

创建 `web/.env.local`，至少包含：

```env
NODE_ENV=production
APP_URL=https://your-domain.com
DATABASE_URL=postgres://witweb:StrongPasswordHere@127.0.0.1:5432/witweb
AUTH_SECRET=替换为32位以上随机串
ENCRYPTION_KEY=替换为32位以上随机串
```

如果启用 Turnstile，再加：

```env
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=你的服务端密钥
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的站点密钥
NEXT_PUBLIC_TURNSTILE_ENABLED=true
```

### 5. 数据库迁移与构建

```bash
cd /var/www/witweb/web
npm run db:migrate
npm run build
```

如果你有旧 SQLite 数据要迁移：

```bash
npm run data:migrate
```

### 6. 用 systemd 守护 Next.js

创建 `/etc/systemd/system/witweb.service`：

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

执行：

```bash
sudo chown -R www-data:www-data /var/www/witweb
sudo systemctl daemon-reload
sudo systemctl enable witweb
sudo systemctl start witweb
sudo systemctl status witweb
```

### 7. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/witweb`：

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

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/witweb /etc/nginx/sites-enabled/witweb
sudo nginx -t
sudo systemctl reload nginx
```

### 8. 可选：启用 HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 常用命令

```bash
cd web
npm run type-check
npm run lint
npm run test
npm run db:migrate:status
```
