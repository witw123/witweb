# WitWeb API 参考

## 说明

本文档只记录当前有效的接口入口。除登录、注册、注销等认证接口外，业务接口统一以 `/api/v1/*` 为准。

统一响应格式：

成功：

```json
{
  "success": true,
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## 认证

### `POST /api/v1/auth/login`

用途：

- 用户登录
- 成功后返回 `token` 和 `profile`
- 服务端同时写入认证 cookie

请求体：

```json
{
  "username": "alice",
  "password": "password123",
  "captchaToken": "optional",
  "adminOnly": false
}
```

> ⚠️ 旧路由 `/api/login` 已废弃，将于 2027-01-01 移除

### `POST /api/v1/auth/register`

用途：

- 注册新用户
- 成功后自动返回 `token` 和 `profile`
- 服务端同时写入认证 cookie

请求体：

```json
{
  "username": "alice",
  "password": "password123",
  "nickname": "Alice",
  "captchaToken": "optional"
}
```

> ⚠️ 旧路由 `/api/register` 已废弃，将于 2027-01-01 移除

### `POST /api/v1/auth/logout`

用途：

- 清理认证 cookie

> ⚠️ 旧路由 `/api/logout` 已废弃，将于 2027-01-01 移除

## 用户与关系

### `GET /api/v1/profile`

用途：

- 获取当前登录用户资料

### `POST /api/v1/profile`

用途：

- 更新当前登录用户资料

请求体：

```json
{
  "nickname": "Alice",
  "avatar_url": "",
  "cover_url": "",
  "bio": "hello"
}
```

### `POST /api/v1/follow`

用途：

- 关注一个用户

请求体：

```json
{
  "username": "bob"
}
```

### `DELETE /api/v1/follow/[username]`

用途：

- 取消关注一个用户

### `GET /api/v1/followers`

用途：

- 获取粉丝列表

查询参数：

- `username`
- `page`
- `size`
- `q`

### `GET /api/v1/following`

用途：

- 获取关注列表

查询参数：

- `username`
- `page`
- `size`
- `q`

### `GET /api/v1/users/[username]/profile`

用途：

- 获取指定用户公开资料

### `GET /api/v1/users/[username]/activity`

用途：

- 获取指定用户动态列表

查询参数：

- `page`
- `size`

## 博客

### `GET /api/v1/blog`

用途：

- 获取文章列表

查询参数：

- `page`
- `size`
- `q`
- `author`
- `tag`
- `category`

示例：

`/api/v1/blog?page=1&size=5&q=ai&tag=agent&category=tools`

### `POST /api/v1/blog`

用途：

- 创建文章

请求体：

```json
{
  "title": "My Post",
  "content": "Markdown content",
  "slug": "",
  "tags": "ai,agent",
  "category_id": 1
}
```

### `GET /api/v1/blog/[slug]`

用途：

- 获取文章详情

### `PUT /api/v1/blog/[slug]`

用途：

- 更新文章

### `DELETE /api/v1/blog/[slug]`

用途：

- 删除文章

### `GET /api/v1/blog/[slug]/comments`

用途：

- 获取文章评论

### `POST /api/v1/blog/[slug]/comments`

用途：

- 发表评论

### `POST /api/v1/blog/[slug]/view`

用途：

- 增加浏览计数

### `POST /api/v1/blog/[slug]/like`

用途：

- 点赞文章

### `POST /api/v1/blog/[slug]/dislike`

用途：

- 点踩文章

### `POST /api/v1/blog/[slug]/favorite`

用途：

- 收藏文章

### `GET /api/v1/categories`

用途：

- 获取分类列表

### `GET /api/v1/tags`

用途：

- 获取标签统计

## 文件上传

### `POST /api/v1/upload`

用途：

- 上传文件（仅支持图片）

请求体：`multipart/form-data` with `file` field

返回：

```json
{
  "success": true,
  "data": { "url": "/uploads/123456-abc.png" }
}
```

> ⚠️ 旧路由 `/api/upload` 已废弃，将于 2027-01-01 移除

### `POST /api/v1/upload/image`

用途：

- 上传图片（同 `/api/v1/upload`）


## 收藏

### `GET /api/v1/favorites`

用途：

- 获取当前用户的收藏列表

查询参数：

- `page`
- `size`

> ⚠️ 旧路由 `/api/favorites` 已废弃，将于 2027-01-01 移除

## 消息

### `GET /api/v1/messages`

用途：

- 获取当前用户会话列表

### `POST /api/v1/messages`

用途：

- 发送私信

请求体：

```json
{
  "receiver": "bob",
  "content": "hello"
}
```

### `GET /api/v1/messages/[conversationId]`

用途：

- 获取会话消息

### `GET /api/v1/messages/notifications?type=replies|at|likes|system`

用途：

- 获取通知列表

### `POST /api/v1/messages/read-notifications`

用途：

- 标记通知已读

### `GET /api/v1/messages/unread`

用途：

- 获取未读数量

## Agent

### `GET /api/v1/agent/conversations`

用途：

- 获取当前用户的 Agent 会话列表

### `POST /api/v1/agent/conversations`

用途：

- 创建新的 Agent 会话

### `GET /api/v1/agent/conversations/[id]`

用途：

- 获取单个 Agent 会话详情

### `DELETE /api/v1/agent/conversations/[id]`

用途：

- 删除一个 Agent 会话

### `GET /api/v1/agent/conversations/by-goal/[goalId]`

用途：

- 将旧 goal 跳转兼容到对应会话

### `POST /api/v1/agent/conversations/[id]/messages`

用途：

- 向会话追加一条消息

### `POST /api/v1/agent/conversations/[id]/messages/stream`

用途：

- 以流式方式向会话发送消息并接收回复

### `GET /api/v1/agent/goals`

用途：

- 获取 Agent goals 的画廊投影列表

### `POST /api/v1/agent/goals`

用途：

- 创建新的 Agent goal 计划

### `GET /api/v1/agent/goals/[id]/timeline`

用途：

- 获取单个 goal 的时间线、审批和交付状态

### `POST /api/v1/agent/goals/[id]/execute`

用途：

- 执行单个 goal

### `POST /api/v1/agent/goals/[id]/execute/stream`

用途：

- 以流式方式执行单个 goal

### `POST /api/v1/agent/approvals/[id]/approve`

用途：

- 批准高风险 Agent 动作

### `POST /api/v1/agent/approvals/[id]/reject`

用途：

- 拒绝高风险 Agent 动作

### `GET /api/v1/agent/tools`

用途：

- 获取当前 Agent 工具注册表

### `GET /api/v1/agent/ping`

用途：

- 检查 Agent 模型连接状态

## 后台

### `GET /api/admin/users`

用途：

- 分页获取后台用户列表

### `POST /api/admin/users`

用途：

- 批量处理用户操作

### `GET /api/admin/categories`

用途：

- 分页获取后台分类列表

### `POST /api/admin/categories`

用途：

- 创建分类

### `GET /api/v1/admin/stats`

用途：

- 获取后台统计

查询参数：

- `view=overview`
- `view=trends&days=7`

## Video

### `GET /api/v1/video/config`

用途：

- 获取视频模块配置

### `POST /api/v1/video/config`

用途：

- 更新视频模块配置

### `GET /api/v1/video/tasks`

用途：

- 获取当前用户的视频任务列表

### `GET /api/v1/video/tasks/[id]`

用途：

- 获取单个视频任务详情

### `GET /api/v1/video/characters`

用途：

- 获取角色列表

### `POST /api/v1/video/create-character`

用途：

- 创建角色任务

### `POST /api/v1/video/upload-character`

用途：

- 上传角色任务

### `POST /api/v1/video/generate`

用途：

- 发起视频生成任务

### `POST /api/v1/video/result`

用途：

- 拉取远端任务结果

### `GET /api/v1/video/history`

用途：

- 获取视频历史

### `GET /api/v1/video/active`

用途：

- 获取活跃任务

### `POST /api/v1/video/active/remove`

用途：

- 移除活跃任务

### `GET /api/v1/video/outputs`

用途：

- 获取本地已落盘视频列表

### `POST /api/v1/video/outputs/finalize`

用途：

- 将远端任务结果固化为本地视频

### `DELETE /api/v1/video/outputs/[name]`

用途：

- 删除一个本地视频产物

## Radar

### `GET /api/v1/radar/sources`

用途：

- 获取当前用户的来源列表

### `POST /api/v1/radar/sources`

用途：

- 创建来源

### `PATCH /api/v1/radar/sources/[id]`

用途：

- 更新来源

### `DELETE /api/v1/radar/sources/[id]`

用途：

- 删除来源

### `GET /api/v1/radar/items`

用途：

- 获取抓取条目

### `DELETE /api/v1/radar/items`

用途：

- 清空条目

### `GET /api/v1/radar/topics`

用途：

- 获取选题列表

### `POST /api/v1/radar/topics`

用途：

- 保存选题

### `DELETE /api/v1/radar/topics/[id]`

用途：

- 删除选题

### `POST /api/v1/radar/fetch`

用途：

- 立即抓取来源

### `POST /api/v1/radar/analyze`

用途：

- 生成热点分析

## 文档约定

1. 优先记录当前有效接口。
2. 默认以 `/api/v1/*` 为业务接口主入口。
3. 文档与代码冲突时，以代码为准，并尽快修正文档。
