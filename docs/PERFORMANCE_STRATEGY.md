# 性能优化策略

## 当前方向

项目当前优先做三类低风险性能优化：

- 图片优化链收口
- 重页面代码分割
- 缓存策略统一

## 已落地

### 图片

- 新增 `shouldBypassImageOptimization()`：
  [url.ts](/d:/code/witweb/web/src/utils/url.ts)
- 规则：
  - 本地路径如 `/uploads/*`、站内相对路径，优先走 Next Image 优化
  - `data:`、`blob:`、未知远程 URL，保留 `unoptimized`

当前已接入的高频组件：

- [PostCard.tsx](/d:/code/witweb/web/src/components/PostCard.tsx)
- [PostCard.tsx](/d:/code/witweb/web/src/features/blog/components/post-list/PostCard.tsx)
- [UserHoverCard.tsx](/d:/code/witweb/web/src/features/blog/components/UserHoverCard.tsx)

### 代码分割

以下重页面已经改成 `next/dynamic`：

- [page.tsx](/d:/code/witweb/web/src/app/messages/page.tsx)
- [page.tsx](/d:/code/witweb/web/src/app/profile/page.tsx)
- [page.tsx](/d:/code/witweb/web/src/app/followers/page.tsx)
- [page.tsx](/d:/code/witweb/web/src/app/following/page.tsx)

目标：

- 降低非首屏页面初始 JS 体积
- 将消息、个人页、关注关系页延迟到访问时加载

## 下一步优先级

### 1. 图片继续收口

继续替换剩余固定 `unoptimized` 用法，优先：

- 个人页头像和关注列表
- 消息页头像
- 友情链接和 About 页图片

### 2. 缓存统一

逐步减少这三层并存：

- TanStack Query
- TanStack Query 统一读缓存
- 减少重复的本地持久化缓存

优先迁移：

- 博客列表 `usePosts`
- 文章详情 / 评论
- 视频任务详情轮询

### 3. 服务端缓存

对低频公共数据补明确策略：

- `categories`
- `tags`
- `about`
- `friend-links`

### 4. 体积审计

后续应补：

- `next build` 产物分析
- 识别最大 client bundle
- 再决定 Studio 是否按模块继续拆分
