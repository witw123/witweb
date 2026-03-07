# API 删除准备度

## 当前结论

项目已经从“旧路由兼容阶段”进入“`/api/v1/*` 主入口收尾阶段”。

当前已经满足的基础条件：
- 前端主调用基本已迁到 `/api/v1/*`
- 大多数 `v1` 路由不再转发旧 route 文件
- 关键 API 已有独立测试覆盖
- 已删除模块都通过了 `type-check` 和定向回归测试

## 已完成删除的模块

- `messages` 兼容子路由
- `admin stats` 兼容子路由
- `video config` 兼容子路由
- `blog`
- `agent`
- `radar` 主路由与边缘兼容层
- `video` 主流程与 outputs
- `user/social`
- `comments`
- `about / stats / track-visit`
- `friend-links`
- `categories`
- `tags`
- `upload-image`

## 当前仍建议保守观察的模块

- 认证入口：`/api/login`、`/api/register`、`/api/logout`
- 上传入口：`/api/upload`
- 尚未完成 Drizzle 迁移的复杂写链路

### 认证入口当前状态

- 前端和 E2E 已切到 `/api/v1/auth/*`
- `v1 auth` 已不再转发旧 route 文件
- 已有独立测试覆盖新旧路径的弃用/非弃用行为

结论：
这组旧认证入口已经进入“可删除准备”，后续只需再观察一个迭代周期即可物理删除。

## 删除前检查项

1. 仓库内无旧入口业务调用。
2. `v1` 路由不再转发旧 route 文件。
3. 新主路径测试已覆盖。
4. `npm run type-check` 与相关测试通过。
