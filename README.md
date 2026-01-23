# Sora2 Web Studio

一个基于 FastAPI 的轻量级 Web 控制台，用于调用 Sora2 视频生成/角色相关接口，并在本地保存生成的视频与历史记录。

## 功能概览

- 前端静态页面（`/static`）用于提交生成/角色任务。
- 支持 Sora2 视频生成、任务轮询与本地视频下载。
- 支持角色上传/创建任务。
- 支持 OpenAPI Key 创建与额度查询。
- 任务、历史记录与配置保存在本地 `data/` 目录。

## 目录结构

```
.
├── core.py            # 核心 API 调用、下载与本地数据存取
├── main.py            # FastAPI 服务入口
├── static/            # 前端静态页面
├── downloads/         # 下载的视频（运行后生成）
└── data/              # 配置与历史数据（运行后生成）
```

## 环境要求

- Python 3.8+
- 依赖：`fastapi`、`uvicorn`、`requests`、`pydantic`

安装依赖示例：

```
pip install fastapi uvicorn requests pydantic
```

## 快速开始

1. 启动服务：

   ```
   python main.py
   ```

2. 打开浏览器访问：

   ```
   http://localhost:8000
   ```

## 配置说明

配置存储在 `data/config.json`，可通过 API 更新：

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
  "duration": 10,
  "url": "https://... (可选)",
  "aspectRatio": "16:9",
  "size": "720p",
  "remixTargetId": "... (可选)"
}
```

### 生成视频（异步）

- 启动任务：

```
POST /generate/start
{
  "prompt": "a cute cat",
  "duration": 10
}
```

- 完成任务并下载：

```
POST /generate/finalize
{
  "id": "TASK_ID",
  "prompt": "a cute cat"
}
```

- 查询结果状态：

```
POST /result
{"id": "TASK_ID"}
```

### 角色相关

- 上传角色：

```
POST /character/upload
{
  "url": "https://...",
  "timestamps": "0,3,6"
}
```

- 创建角色：

```
POST /character/create
{
  "pid": "PID",
  "timestamps": "0,3,6"
}
```

### OpenAPI 与额度

- 创建 API Key：

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

- 查询 API Key 额度：

```
POST /openapi/api-key-credits
{"apiKey": "YOUR_API_KEY"}
```

- 查询账户额度：

```
POST /openapi/credits
{"token": "YOUR_TOKEN"}
```

### 视频管理

- 本地视频列表：

```
GET /videos
```

- 删除本地视频：

```
POST /videos/delete
{"name": "sora_123.mp4"}
```

## 数据与下载说明

- 生成的视频默认保存到 `downloads/`。
- 历史记录保存到 `data/history.json`。
- 活跃任务保存到 `data/active_tasks.json`。

## 备注

- 若 API 报错或网络异常，会在接口返回中体现错误信息。
- 如需变更 API 主机，可通过 `host_mode` 选择 `domestic` 或 `overseas`。

## License

本项目未指定 License。
