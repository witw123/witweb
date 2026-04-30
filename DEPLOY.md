# WitWeb Docker 部署指南

## 环境要求

- Docker & Docker Compose
- PostgreSQL 14+ (或使用 Docker 部署)
- Nginx (用于反向代理和 SSL)
- 域名解析已配置

## 快速部署

### 1. 克隆代码

```bash
git clone https://gitee.com/witw/witweb.git
cd witweb
```

### 2. 配置环境变量

```bash
cp web/.env.production.example web/.env.production
# 编辑 web/.env.production，修改以下配置：
# - DATABASE_URL: 数据库连接串
# - AUTH_SECRET: JWT 密钥
# - APP_URL: 网站访问地址 (如 https://witweb.example.com)
```

### 3. 启动服务

```bash
docker-compose up -d --build
```

### 4. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name witweb.example.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. 配置 SSL 证书

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 获取 SSL 证书
certbot --nginx -d witweb.example.com
```

## 数据库配置

### 使用外部 PostgreSQL

修改 `web/.env.production` 中的 DATABASE_URL：

```
DATABASE_URL=postgres://用户名:密码@数据库地址:5432/数据库名
```

### 使用 Docker PostgreSQL

使用 docker-compose.yml 中已配置的 PostgreSQL：

```bash
# 创建数据库和用户
docker exec -it witweb_postgres_1 psql -U postgres -c "CREATE USER witweb WITH PASSWORD 'your_password';"
docker exec -it witweb_postgres_1 psql -U postgres -c "CREATE DATABASE witweb OWNER witweb;"
docker exec -it witweb_postgres_1 psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE witweb TO witweb;"

# 安装 pgvector 扩展 (如果需要)
docker exec -it witweb_postgres_1 psql -U postgres -d witweb -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 恢复数据库备份

```bash
# 恢复 PostgreSQL 备份
docker exec -it witweb_postgres_1 pg_restore -U witweb -d witweb -c /path/to/backup.dump
```

## 部署结构

```
witweb/
├── web/
│   ├── Dockerfile          # 生产镜像
│   ├── Dockerfile.prod
│   └── .env.production     # 生产环境配置
├── docker-compose.yml       # 服务编排
├── nginx/
│   └── witweb_proxy        # Nginx 配置
└── DEPLOY.md               # 本文档
```

## 常用命令

```bash
# 查看日志
docker-compose logs -f web

# 重启服务
docker-compose restart web

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build

# 进入容器
docker exec -it witweb_web_1 bash
```

## 数据备份

```bash
# 备份数据库
docker exec -it witweb_postgres_1 pg_dump -U witweb -d witweb -Fc > backup_$(date +%Y%m%d).dump

# 备份上传文件
tar -czf uploads_$(date +%Y%m%d).tar.gz web/uploads/
```

## 故障排查

### 登录 Cookie 问题

如果登录成功但界面显示未登录：
1. 确保使用 HTTPS 访问 (APP_URL 必须是 https://)
2. 清除浏览器缓存
3. 检查 Nginx 是否正确转发 X-Forwarded-Proto

### 数据库连接问题

1. 检查 DATABASE_URL 配置
2. 确认数据库用户权限
3. 验证网络连接 (Docker 网络)

### 端口冲突

如果 3003 端口被占用，修改 docker-compose.yml 中的端口映射。
