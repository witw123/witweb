# WitWeb Repository 层

数据访问层（Repository 模式），分离数据库操作逻辑。

## 设计原则

1. **单一职责**：每个 Repository 只操作一个实体
2. **类型安全**：返回类型使用 `@/types` 中的类型定义
3. **事务支持**：通过 `options.db` 参数传入数据库实例实现事务
4. **统一错误处理**：错误统一抛出 `ApiError`
5. **清晰的命名**：方法命名清晰：find/get/list/create/update/delete 等

## 文件结构

```
web/src/lib/repositories/
├── base-repository.ts      # 抽象基类，提供通用 CRUD 操作
├── user-repository.ts      # 用户相关数据操作
├── post-repository.ts      # 文章相关数据操作
├── comment-repository.ts   # 评论相关数据操作
├── video-task-repository.ts # 视频任务数据操作
├── message-repository.ts   # 私信数据操作
├── index.ts               # 统一导出
└── README.md              # 本文档
```

## 快速开始

### 基本用法

```typescript
import { userRepository, postRepository } from '@/lib/repositories';

// 查找用户
const user = userRepository.findByUsername('john');
if (!user) {
  throw new Error('User not found');
}

// 创建文章
const postId = postRepository.create({
  title: 'Hello World',
  slug: 'hello-world',
  content: '# Hello\n\nWorld!',
  author: 'john',
  tags: 'hello,world',
  category_id: 1
});

// 获取文章列表
const posts = postRepository.list({
  page: 1,
  size: 10,
  query: 'hello',
  username: 'john' // 用于判断收藏状态
});
```

### 事务支持

```typescript
import { userRepository, postRepository } from '@/lib/repositories';
import { getBlogDb } from '@/lib/db';

// 使用事务
const db = getBlogDb();
const result = db.transaction(() => {
  // 在事务中操作，传入 db 实例
  const postId = postRepository.create({
    title: 'New Post',
    slug: 'new-post',
    content: '...',
    author: 'john'
  }, { db });
  
  // 创建关联的评论
  commentRepository.create({
    post_id: postId,
    author: 'john',
    content: 'First comment'
  }, { db });
  
  return postId;
})(db);
```

### 错误处理

```typescript
import { userRepository } from '@/lib/repositories';
import { ApiError, ErrorCode } from '@/lib/api-error';

try {
  const user = userRepository.findByUsername('john');
  if (!user) {
    throw ApiError.notFound('user');
  }
} catch (error) {
  if (error instanceof ApiError) {
    // 处理已知的 API 错误
    console.log(error.code, error.statusCode);
  } else {
    // 处理未知错误
    console.error('Unexpected error:', error);
  }
}
```

## Repository 详情

### UserRepository

操作用户和关注关系。

```typescript
// 用户操作
userRepository.findByUsername(username: string): User | null
userRepository.findByUsernameWithPassword(username: string): User | null
userRepository.existsByUsername(username: string): boolean
userRepository.create(data: CreateUserData): number
userRepository.update(username: string, data: UpdateUserData): boolean
userRepository.updatePassword(username: string, hashedPassword: string): boolean
userRepository.updateBalance(username: string, amount: number): boolean
userRepository.markNotificationsAsRead(username: string): boolean
userRepository.deleteByUsername(username: string): boolean
userRepository.list(page?: number, size?: number, search?: string): PaginatedResult<User>

// 关注操作
userRepository.getFollowCounts(username: string): { following_count: number; follower_count: number }
userRepository.isFollowing(follower: string, following: string): boolean
userRepository.follow(follower: string, following: string): boolean
userRepository.unfollow(follower: string, following: string): boolean
userRepository.listFollowing(username: string, page?: number, size?: number, query?: string, viewer?: string): FollowingListResponse
userRepository.listFollowers(username: string, page?: number, size?: number, query?: string, viewer?: string): FollowerListResponse
```

### PostRepository

操作文章、分类、点赞、收藏等。

```typescript
// 文章操作
postRepository.findBySlug(slug: string): Post | null
postRepository.getPostDetail(slug: string, username?: string): PostDetail | null
postRepository.create(data: CreatePostData): number
postRepository.updateBySlug(slug: string, data: UpdatePostData): boolean
postRepository.updateAuthor(slug: string, author: string): boolean
postRepository.softDelete(slug: string): boolean
postRepository.hardDelete(slug: string, options?: QueryOptions): boolean
postRepository.incrementViewCount(slug: string): number
postRepository.getPostCountByAuthor(author: string): number
postRepository.search(query: string, page?: number, size?: number): PaginatedResult<PostListItem>
postRepository.list(params: ListPostsParams): PaginatedResult<PostListItem>

// 点赞操作
postRepository.toggleLike(slug: string, username: string, value: 1 | -1): { liked?: boolean; disliked?: boolean }
postRepository.isLiked(postId: number, username: string): boolean
postRepository.getLikeCount(postId: number): number
postRepository.getUserLikesReceived(username: string): number

// 收藏操作
postRepository.toggleFavorite(slug: string, username: string): boolean
postRepository.isFavorited(postId: number, username: string): boolean
postRepository.getFavoriteCount(postId: number): number
postRepository.listFavorites(username: string, page?: number, size?: number): PaginatedResult<PostListItem>

// 分类操作
postRepository.listCategories(includeInactive?: boolean): Category[]
postRepository.getCategoryById(id: number): Category | null
postRepository.getCategoryBySlug(slug: string): Category | null
postRepository.createCategory(data: {...}): number
postRepository.updateCategory(id: number, data: {...}): boolean
postRepository.deleteCategory(id: number): boolean

// 友链操作
postRepository.listFriendLinks(includeInactive?: boolean): FriendLink[]
postRepository.createFriendLink(data: {...}): number
postRepository.updateFriendLink(id: number, data: {...}): boolean
postRepository.deleteFriendLink(id: number): boolean
```

### CommentRepository

操作评论和评论投票。

```typescript
// 评论操作
commentRepository.findByPostId(postId: number): CommentListItem[]
commentRepository.findByPostSlug(slug: string): CommentListItem[]
commentRepository.create(data: CreateCommentData): number
commentRepository.updateContent(id: number, content: string): boolean
commentRepository.delete(id: number, options?: QueryOptions): boolean
commentRepository.getPostSlugForComment(commentId: number): string

// 投票操作
commentRepository.vote(commentId: number, username: string, value: 1 | -1): boolean
commentRepository.removeVote(commentId: number, username: string): boolean
commentRepository.getUserVote(commentId: number, username: string): 1 | -1 | null
commentRepository.getVoteCounts(commentId: number): { like_count: number; dislike_count: number }

// 通知相关
commentRepository.getRepliesToUser(username: string, page?: number, size?: number): NotificationItem[]
commentRepository.getMentionsToUser(username: string, page?: number, size?: number): NotificationItem[]
commentRepository.getNewCommentsCount(username: string, since: string): number
commentRepository.getCommentCountByPostId(postId: number): number
commentRepository.getCommentCountByAuthor(author: string): number
commentRepository.getStats(): { total: number; today: number; week: number }
```

### VideoTaskRepository

操作视频任务、结果、角色等。

```typescript
// 任务操作
videoTaskRepository.findById(id: string): VideoTask | null
videoTaskRepository.findByIdAndUser(id: string, username: string): VideoTask | null
videoTaskRepository.create(data: CreateVideoTaskData): string
videoTaskRepository.updateStatus(id: string, data: UpdateVideoTaskData): boolean
videoTaskRepository.deleteById(id: string, username?: string, options?: QueryOptions): boolean
videoTaskRepository.listByUser(username: string, page?: number, size?: number, taskType?: VideoTaskType): PaginatedResult<VideoTask>
videoTaskRepository.getRecentByUser(username: string, limit?: number): VideoTask[]
videoTaskRepository.getPendingTasks(): VideoTask[]

// 结果操作
videoTaskRepository.getResultsByTaskId(taskId: string): VideoResult[]
videoTaskRepository.addResult(taskId: string, url: string, data?: {...}): number
videoTaskRepository.addResults(taskId: string, results: Array<...>): void
videoTaskRepository.deleteResultsByTaskId(taskId: string): number

// 角色操作
videoTaskRepository.listCharacters(username: string): Character[]
videoTaskRepository.getCharacterById(characterId: string, username?: string): Character | null
videoTaskRepository.createCharacter(data: CreateCharacterData): number
videoTaskRepository.updateCharacterName(characterId: string, name: string): boolean
videoTaskRepository.deleteCharacter(characterId: string, username?: string): boolean

// 活跃任务
videoTaskRepository.addActiveTask(taskId: string, prompt: string): boolean
videoTaskRepository.removeActiveTask(taskId: string): boolean
videoTaskRepository.getActiveTasks(): Array<{ id: string; prompt: string; start_time: number }>

// 配置操作
videoTaskRepository.getConfig(): StudioConfig
videoTaskRepository.getConfigValue(key: keyof StudioConfig): unknown
videoTaskRepository.setConfigValue(key: keyof StudioConfig, value: unknown): boolean
videoTaskRepository.deleteConfig(key: keyof StudioConfig): boolean

// 历史记录
videoTaskRepository.addHistory(data: {...}): number
videoTaskRepository.getHistory(): StudioHistory[]
videoTaskRepository.getHistoryByTaskId(taskId: string): StudioHistory | null
videoTaskRepository.deleteHistory(id: number): boolean

// 任务时间
videoTaskRepository.recordTaskTime(taskId: string, timestamp?: number): boolean
videoTaskRepository.getTaskTime(taskId: string): number | null
videoTaskRepository.deleteTaskTime(taskId: string): boolean

// 统计
videoTaskRepository.getUserStats(username: string): { total: number; pending: number; succeeded: number; failed: number }
```

### MessageRepository

操作对话和私信。

```typescript
// 对话操作
messageRepository.getOrCreateConversation(user1: string, user2: string): { id: number; isNew: boolean }
messageRepository.getConversationById(id: number): Conversation | null
messageRepository.canAccessConversation(conversationId: number, username: string): boolean
messageRepository.getConversations(username: string): Conversation[]
messageRepository.getConversationList(username: string): ConversationListItem[]
messageRepository.updateLastMessage(conversationId: number, message: string): boolean
messageRepository.incrementUnread(conversationId: number, forUser: string): boolean
messageRepository.resetUnread(conversationId: number, forUser: string): boolean
messageRepository.deleteConversation(id: number): boolean

// 消息操作
messageRepository.sendMessage(data: SendMessageData): { conversationId: number; messageId: number }
messageRepository.getMessagesByConversation(conversationId: number): PrivateMessage[]
messageRepository.getMessagesAndMarkAsRead(conversationId: number, username: string): PrivateMessage[]
messageRepository.getMessagesPaginated(conversationId: number, page?: number, size?: number): PaginatedResult<PrivateMessage>
messageRepository.markAsRead(messageId: number): boolean
messageRepository.markConversationAsRead(conversationId: number, username: string): number
messageRepository.deleteMessage(messageId: number, username: string): boolean

// 未读统计
messageRepository.getTotalUnread(username: string): number
messageRepository.getUnreadInConversation(conversationId: number, username: string): number
messageRepository.getUnreadMessages(username: string): PrivateMessage[]

// 统计
messageRepository.getUserStats(username: string): { total_sent: number; total_received: number; unread: number; conversations: number }
messageRepository.getRecentMessages(username: string, limit?: number): PrivateMessage[]
messageRepository.getLastMessageWith(otherUser: string, currentUser: string): PrivateMessage | null
```

## 迁移指南

### 从旧代码迁移

旧代码（直接在业务逻辑中写 SQL）：

```typescript
// lib/blog.ts - 旧方式
export function getPost(slug: string) {
  const db = getBlogDb();
  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ?
  `).get(slug);
  return row;
}
```

新代码（使用 Repository）：

```typescript
// 在业务逻辑层
import { postRepository } from '@/lib/repositories';

export function getPost(slug: string, username?: string) {
  return postRepository.getPostDetail(slug, username);
}
```

## 注意事项

1. **服务器端使用**：Repository 层只能在服务器端使用，因为它们直接操作数据库
2. **事务边界**：在事务中操作时，记得传入 `{ db }` 选项
3. **错误处理**：Repository 会抛出 `ApiError`，调用方需要正确处理
4. **类型安全**：使用 TypeScript 类型确保数据正确性

## 扩展

如需添加新的 Repository：

1. 创建新的 Repository 类继承 `BaseRepository<T, K>`
2. 实现 `getDb()` 和 `tableName`
3. 添加业务相关方法
4. 在 `index.ts` 中导出

```typescript
// repositories/custom-repository.ts
import { BaseRepository, type QueryOptions } from './base-repository';
import { getCustomDb } from '@/lib/db';
import type { CustomEntity } from '@/types';

export class CustomRepository extends BaseRepository<CustomEntity, number> {
  protected readonly tableName = 'custom_table';
  
  protected getDb(options?: QueryOptions) {
    return options?.db || getCustomDb();
  }
  
  // 自定义方法...
}

export const customRepository = new CustomRepository();
```
