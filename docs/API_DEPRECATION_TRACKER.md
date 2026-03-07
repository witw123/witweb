# API 弃用追踪

## 当前策略

- 新代码只使用 `/api/v1/*`
- 仍需兼容的旧 `/api/*` 先保留弃用头
- 仓库内确认无依赖后，再物理删除旧入口

统一弃用头：
- `Deprecation: true`
- `Sunset: 2026-12-31`
- `Link: <...>; rel="successor-version"`

## 已物理删除的旧路由

### Messages
- `/api/messages/conversations`
- `/api/messages/send`
- `/api/messages/notifications`
- `/api/messages/read-notifications`
- `/api/messages/unread`

### Admin Stats
- `/api/admin/stats/overview`
- `/api/admin/stats/trends`

### Video Config
- `/api/video/config/api-key`
- `/api/video/config/token`
- `/api/video/config/host-mode`
- `/api/video/config/query-defaults`

### Blog
- `/api/blog`
- `/api/blog/[slug]`
- `/api/blog/[slug]/comments`
- `/api/blog/[slug]/view`
- `/api/blog/[slug]/like`
- `/api/blog/[slug]/dislike`
- `/api/blog/[slug]/favorite`

### Agent
- `/api/agent/run`
- `/api/agent/run/stream`
- `/api/agent/runs`
- `/api/agent/runs/[id]`
- `/api/agent/runs/[id]/continue`
- `/api/agent/runs/[id]/export-to-publish`
- `/api/agent/ping`

### Radar
- `/api/radar/sources`
- `/api/radar/sources/[id]`
- `/api/radar/items`
- `/api/radar/topics`
- `/api/radar/topics/[id]`
- `/api/radar/fetch`
- `/api/radar/analyze`
- `/api/radar/notifications`
- `/api/radar/notifications/[id]`
- `/api/radar/alert-rules`
- `/api/radar/alert-rules/[id]`
- `/api/radar/alert-logs`

### Site Public
- `/api/about`
- `/api/stats`
- `/api/track-visit`
- `/api/friend-links`
- `/api/friend-links/[id]`
- `/api/categories`
- `/api/tags`
- `/api/upload-image`

### Video
- `/api/video/tasks`
- `/api/video/tasks/[id]`
- `/api/video/characters`
- `/api/video/create-character`
- `/api/video/upload-character`
- `/api/video/generate`
- `/api/video/result`
- `/api/video/history`
- `/api/video/active`
- `/api/video/active/remove`
- `/api/video/videos`
- `/api/video/videos/delete`
- `/api/video/finalize`

### User And Social
- `/api/profile`
- `/api/follow`
- `/api/follow/[username]`
- `/api/followers`
- `/api/following`
- `/api/users/[username]/profile`
- `/api/users/[username]/activity`

### Comments
- `/api/comment/[id]`
- `/api/comment/[id]/like`
- `/api/comment/[id]/dislike`

## 仍保留兼容层的旧路由

- `/api/login`
- `/api/register`
- `/api/logout`
- `/api/upload`

这几条都已经有明确的 `/api/v1/*` successor，仓库内业务调用已切走，当前只保留过渡兼容和弃用头。
