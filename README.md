# Sora2 Web Studio

基于 FastAPI 的轻量级 Web 控制台，用于调用 Sora2 视频生成/角色相关接口，并在本地保存生成的视频与历史记录。前端使用 Vite 构建，产物由后端直接托管。

## 目录结构

```
.
├─ backend/              # FastAPI 后端
│  ├─ main.py            # FastAPI 服务入口
│  ├─ core.py            # 核心逻辑
│  ├─ data/              # 配置与历史数据（运行后生成）
│  └─ downloads/         # 生成的视频（运行后生成）
├─ frontend/             # Vite 前端工程
│  ├─ index.html         # 前端源码入口
│  ├─ src/
│  └─ dist/              # build 后生成（部署产物）
├─ Dockerfile
├─ docker-compose.yml
└─ README.md
```

## 环境要求

- Python 3.8+
- Node.js 18+（用于前端构建）
- 依赖：`fastapi`、`uvicorn`、`requests`、`pydantic`

安装 Python 依赖示例：

```bash
pip install fastapi uvicorn requests pydantic
```

## 本地开发

### 1) 启动后端

在仓库根目录执行：

```bash
python backend/main.py
```

访问地址：

```
http://localhost:8000
```

### 2) 运行/构建前端

进入前端目录：

```bash
cd frontend
```

开发模式：

```bash
npm install
npm run dev
```

构建并由后端提供静态资源：

```bash
npm install
npm run build
```

后端会从 `frontend/dist` 提供静态资源。

## 为什么有两个 HTML 文件

- `frontend/index.html`：Vite 前端源码入口，开发和构建时使用。
- `frontend/dist/index.html`：构建产物，`npm run build` 后生成，后端对外提供的页面。

请只编辑 `frontend/index.html`，不要手改 `frontend/dist/index.html`。

## 容器化部署（Docker）

前端必须先构建出 `frontend/dist`，Docker 里不跑 dev server。

### 构建前端

```bash
cd frontend
npm install
npm run build
```

### 构建镜像

```bash
docker build -t sora2-web .
```

### 启动容器

```bash
docker run -d \
  --name sora2-web \
  -p 8000:8000 \
  -v ./backend/data:/app/backend/data \
  -v ./backend/downloads:/app/backend/downloads \
  --restart unless-stopped \
  sora2-web
```

### 使用 docker compose

```bash
docker compose up -d
```

常用运维命令：

```bash
docker ps

docker logs -f sora2-web

docker stop sora2-web

docker start sora2-web

docker restart sora2-web

docker rm -f sora2-web
```

## 配置说明

配置存储在 `backend/data/config.json`，可通过 API 更新：

- 设置 API Key（用于请求 Sora2 API）：

```
POST /config/api-key
{"api_key": "YOUR_API_KEY"}
```

- 设置 Token（用于额度相关接口）：

```
POST /config/token
{"token": "YOUR_TOKEN"}
```

- 设置 Host 模式：

```
POST /config/host-mode
{"host_mode": "auto|domestic|overseas"}
```

- 设置默认查询参数（会合并到现有配置中）：

```
POST /config/query-defaults
{"data": {"aspectRatio": "16:9"}}
```

查询当前配置：

```
GET /config
```

## 常用接口

> 所有接口均为 JSON 格式

### 生成视频（同步）

```
POST /generate
{
  "prompt": "a cute cat",
  "duration": 15,
  "url": "https://... (可选)",
  "aspectRatio": "16:9",
  "size": "large",
  "remixTargetId": "... (可选)"
}
```

### 生成视频（异步）

启动任务：

```
POST /generate/start
{
  "prompt": "a cute cat",
  "duration": 15
}
```

完成任务并下载：

```
POST /generate/finalize
{
  "id": "TASK_ID",
  "prompt": "a cute cat"
}
```

查询结果状态：

```
POST /result
{"id": "TASK_ID"}
```

### 角色相关

上传角色：

```
POST /character/upload
{
  "url": "https://...",
  "timestamps": "0,3,6"
}
```

创建角色：

```
POST /character/create
{
  "pid": "PID",
  "timestamps": "0,3,6"
}
```

### OpenAPI 与额度

创建 API Key：

```
POST /openapi/create-api-key
{
  "token": "YOUR_TOKEN",
  "type": 0,
  "name": "demo",
  "credits": 0,
  "expireTime": 0
}
```

查询 API Key 额度：

```
POST /openapi/api-key-credits
{"apiKey": "YOUR_API_KEY"}
```

查询账户额度：

```
POST /openapi/credits
{"token": "YOUR_TOKEN"}
```

### 视频管理

本地视频列表：

```
GET /videos
```

删除本地视频：

```
POST /videos/delete
{"name": "sora_123.mp4"}
```

## 数据与下载说明

- 生成的视频默认保存到 `backend/downloads/`
- 历史记录保存到 `backend/data/history.json`
- 活动任务保存到 `backend/data/active_tasks.json`

## 备注

- API 报错或网络异常会在接口返回中体现错误信息。
- 如需变更 API 主机，可通过 `host_mode` 选择 `domestic` 或 `overseas`。


## API 配置脚本

使用 `scripts/config_api.sh` 进行 API Key/Token/Host Mode 配置（交互式）：

```bash
chmod +x /opt/sora2_web/scripts/config_api.sh
/opt/sora2_web/scripts/config_api.sh
```

如果服务不在本机，可使用 `SERVER_URL` 指定：

```bash
SERVER_URL="http://<服务器IP>:8000" /opt/sora2_web/scripts/config_api.sh
```

## 更新并重启（单条命令）

适用于非 Docker 部署：

```bash
cd /opt/sora2_web && git pull && cd frontend && npm install && npm run build && (pkill -f "backend.main:app" || pkill -f "backend/main.py" || true) && cd /opt/sora2_web && nohup python3 -m uvicorn main:app --app-dir backend --host :: --port 8000 > /opt/sora2_web/server.log 2>&1 &
```
## License

本项目未指定 License。