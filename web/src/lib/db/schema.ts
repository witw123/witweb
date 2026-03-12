/**
 * 数据库 Schema 定义
 *
 * 使用 Drizzle ORM 定义 PostgreSQL 数据库表结构
 * 包含用户、博客文章、评论、关注、私信等核心业务表
 */
import { sql } from "drizzle-orm";
import { bigserial, bigint, doublePrecision, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 用户表
 *
 * 存储系统用户的基本信息，包括账户凭证、角色、个人资料等
 */
export const users = pgTable("users", {
  /** 用户唯一标识，自增主键 */
  id: bigserial("id", { mode: "number" }).primaryKey(),
  /** 用户名，用于登录和显示，必须唯一 */
  username: text("username").notNull().unique(),
  /** 加密后的密码 */
  password: text("password").notNull(),
  /** 用户角色：user（普通用户）、admin（管理员） */
  role: text("role").notNull().default("user"),
  /** 昵称，用于显示，可选 */
  nickname: text("nickname"),
  /** 头像 URL */
  avatarUrl: text("avatar_url"),
  /** 封面图 URL */
  coverUrl: text("cover_url"),
  /** 个人简介 */
  bio: text("bio"),
  /** 用户积分余额 */
  balance: doublePrecision("balance").notNull().default(0),
  /** 账户创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  /** 最后一次读取通知的时间，用于未读计数 */
  lastReadNotificationsAt: timestamp("last_read_notifications_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`'1970-01-01 00:00:00+00'`),
  /** 是否为机器人账户：0-否，1-是 */
  isBot: integer("is_bot").notNull().default(0),
});

/**
 * 分类表
 *
 * 博客文章的分类，支持排序和启用/禁用状态
 */
export const categories = pgTable(
  "categories",
  {
    /** 分类唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 分类名称 */
    name: text("name").notNull().unique(),
    /** URL 友好的分类标识符 */
    slug: text("slug").notNull().unique(),
    /** 分类描述 */
    description: text("description").notNull().default(""),
    /** 排序顺序，数值越小越靠前 */
    sortOrder: integer("sort_order").notNull().default(0),
    /** 是否启用：1-启用，0-禁用 */
    isActive: integer("is_active").notNull().default(1),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    sortOrderIdx: index("idx_categories_sort_order").on(table.sortOrder),
  })
);

/**
 * 文章表
 *
 * 存储博客文章内容，包含标题、slug、正文、分类等信息
 */
export const posts = pgTable(
  "posts",
  {
    /** 文章唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 文章标题 */
    title: text("title").notNull(),
    /** URL 友好的文章标识符，用于永久链接 */
    slug: text("slug").notNull().unique(),
    /** 文章正文内容（Markdown 格式） */
    content: text("content").notNull(),
    /** 文章摘要，用于列表展示 */
    excerpt: text("excerpt"),
    /** 封面图片 URL */
    coverImageUrl: text("cover_image_url"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 作者用户名，关联 users 表，删除用户时级联删除文章 */
    author: text("author")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 文章标签，逗号分隔的字符串 */
    tags: text("tags"),
    /** 文章状态：published（已发布）、draft（草稿） */
    status: text("status").notNull().default("published"),
    /** 分类 ID，关联 categories 表，删除分类时设置为 null */
    categoryId: bigint("category_id", { mode: "number" }).references(() => categories.id, {
      onDelete: "set null",
    }),
    /** 浏览次数 */
    viewCount: integer("view_count").notNull().default(0),
  },
  (table) => ({
    authorIdx: index("idx_posts_author").on(table.author),
    createdAtIdx: index("idx_posts_created_at").on(table.createdAt),
    categoryIdIdx: index("idx_posts_category_id").on(table.categoryId),
  })
);

/**
 * 评论表
 *
 * 存储文章的评论内容，支持嵌套回复（parentId）
 */
export const comments = pgTable(
  "comments",
  {
    /** 评论唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 所属文章 ID，删除文章时级联删除评论 */
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** 评论作者用户名 */
    author: text("author")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 评论内容 */
    content: text("content").notNull(),
    /** 评论时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 父评论 ID，用于嵌套回复，null 表示顶级评论 */
    parentId: bigint("parent_id", { mode: "number" }),
    /** 评论者 IP 地址 */
    ipAddress: text("ip_address"),
  },
  (table) => ({
    postIdx: index("idx_comments_post").on(table.postId),
    createdAtIdx: index("idx_comments_created_at").on(table.createdAt),
  })
);

/**
 * 点赞表
 *
 * 记录用户对文章的点赞，每个用户只能对同一篇文章点赞一次
 */
export const likes = pgTable(
  "likes",
  {
    /** 点赞唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 被点赞的文章 ID */
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** 点赞用户用户名 */
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 点赞时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_likes_post").on(table.postId),
    usernameIdx: index("idx_likes_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

/**
 * 踩表
 *
 * 记录用户对文章的踩，每个用户只能对同一篇文章踩一次
 */
export const dislikes = pgTable(
  "dislikes",
  {
    /** 踩的唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 被踩的文章 ID */
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** 踩的用户用户名 */
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 踩的时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_dislikes_post").on(table.postId),
    usernameIdx: index("idx_dislikes_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

/**
 * 收藏表
 *
 * 记录用户收藏的文章，每个用户只能收藏同一篇文章一次
 */
export const favorites = pgTable(
  "favorites",
  {
    /** 收藏唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 被收藏的文章 ID */
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** 收藏用户用户名 */
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 收藏时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_favorites_post").on(table.postId),
    usernameIdx: index("idx_favorites_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

/**
 * 评论投票表
 *
 * 记录用户对评论的投票（支持/反对），每个用户只能对同一评论投票一次
 */
export const commentVotes = pgTable(
  "comment_votes",
  {
    /** 投票唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 被投票的评论 ID */
    commentId: bigint("comment_id", { mode: "number" })
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    /** 投票用户用户名 */
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 投票值：1 表示支持，-1 表示反对 */
    value: integer("value").notNull(),
    /** 投票时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    commentIdx: index("idx_comment_votes_comment").on(table.commentId),
    usernameIdx: index("idx_comment_votes_username").on(table.username),
    commentUserUnique: unique().on(table.commentId, table.username),
  })
);

/**
 * 关注表
 *
 * 记录用户之间的关注关系，支持双向关注
 */
export const follows = pgTable(
  "follows",
  {
    /** 关注关系唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 关注者用户名 */
    follower: text("follower")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 被关注者用户名 */
    following: text("following")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 关注时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    followerFollowingUnique: unique().on(table.follower, table.following),
    followerIdx: index("idx_follows_follower").on(table.follower),
    followingIdx: index("idx_follows_following").on(table.following),
  })
);

/**
 * 会话表
 *
 * 存储用户之间的私信会话，每个会话包含两个用户
 */
export const conversations = pgTable(
  "conversations",
  {
    /** 会话唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 用户1用户名 */
    user1: text("user1")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 用户2用户名 */
    user2: text("user2")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 最后一条消息内容 */
    lastMessage: text("last_message"),
    /** 最后消息时间 */
    lastTime: timestamp("last_time", { withTimezone: true, mode: "string" }),
    /** 用户1的未读消息数量 */
    unreadCountUser1: integer("unread_count_user1").notNull().default(0),
    /** 用户2的未读消息数量 */
    unreadCountUser2: integer("unread_count_user2").notNull().default(0),
  },
  (table) => ({
    user1Idx: index("idx_conversations_user1").on(table.user1),
    user2Idx: index("idx_conversations_user2").on(table.user2),
  })
);

/**
 * 私信消息表
 *
 * 存储用户之间的私信内容，每条消息属于一个会话
 */
export const privateMessages = pgTable(
  "private_messages",
  {
    /** 消息唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 所属会话 ID，删除会话时级联删除消息 */
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** 发送者用户名 */
    sender: text("sender")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 接收者用户名 */
    receiver: text("receiver")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 消息内容 */
    content: text("content").notNull(),
    /** 是否已读：0-未读，1-已读 */
    isRead: integer("is_read").notNull().default(0),
    /** 发送时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    conversationIdx: index("idx_private_messages_conversation").on(table.conversationId),
    receiverIdx: index("idx_private_messages_receiver").on(table.receiver),
    senderIdx: index("idx_private_messages_sender").on(table.sender),
  })
);

/**
 * Agent 运行记录表
 *
 * 记录 AI Agent 的运行历史，用于追踪任务执行状态
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    /** 运行记录唯一标识（UUID） */
    id: text("id").primaryKey(),
    /** 发起运行的用户名 */
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** Agent 目标/任务描述 */
    goal: text("goal").notNull(),
    /** Agent 类型 */
    agentType: text("agent_type").notNull(),
    /** 运行状态 */
    status: text("status").notNull(),
    /** 使用的模型 */
    model: text("model").notNull(),
    /** 错误信息（如果有） */
    errorMessage: text("error_message").notNull().default(""),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_agent_runs_username").on(table.username),
    createdAtIdx: index("idx_agent_runs_created_at").on(table.createdAt),
  })
);

/**
 * Agent 步骤表
 *
 * 记录 Agent 运行过程中的每个步骤，用于追踪执行进度
 */
export const agentSteps = pgTable(
  "agent_steps",
  {
    /** 步骤唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 所属运行记录 ID */
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    /** 步骤标识键 */
    stepKey: text("step_key").notNull(),
    /** 步骤标题 */
    stepTitle: text("step_title").notNull(),
    /** 步骤状态 */
    status: text("status").notNull(),
    /** 输入 JSON 数据 */
    inputJson: text("input_json").notNull().default(""),
    /** 输出 JSON 数据 */
    outputJson: text("output_json").notNull().default(""),
    /** 开始时间 */
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 完成时间 */
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  },
  (table) => ({
    runIdx: index("idx_agent_steps_run_id").on(table.runId),
  })
);

/**
 * Agent 产物表
 *
 * 记录 Agent 运行过程中生成的产物（如生成的文件、代码等）
 */
export const agentArtifacts = pgTable(
  "agent_artifacts",
  {
    /** 产物唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 所属运行记录 ID */
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    /** 产物类型 */
    kind: text("kind").notNull(),
    /** 产物内容 */
    content: text("content").notNull(),
    /** 元数据 JSON */
    metaJson: text("meta_json").notNull().default("{}"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("idx_agent_artifacts_run_id").on(table.runId),
    kindIdx: index("idx_agent_artifacts_kind").on(table.kind),
  })
);

/**
 * 话题数据源表
 *
 * 存储外部话题/新闻来源的配置，用于雷达功能的数据采集
 */
export const topicSources = pgTable(
  "topic_sources",
  {
    /** 数据源唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 数据源名称 */
    name: text("name").notNull(),
    /** 数据源 URL */
    url: text("url").notNull(),
    /** 数据源类型 */
    type: text("type").notNull(),
    /** 解析器配置 JSON */
    parserConfigJson: text("parser_config_json").notNull().default("{}"),
    /** 是否启用：1-启用，0-禁用 */
    enabled: integer("enabled").notNull().default(1),
    /** 最后一次抓取状态 */
    lastFetchStatus: text("last_fetch_status").notNull().default("idle"),
    /** 最后一次抓取错误信息 */
    lastFetchError: text("last_fetch_error").notNull().default(""),
    /** 最后一次抓取时间 */
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true, mode: "string" }),
    /** 最后一次抓取的数据条数 */
    lastFetchCount: integer("last_fetch_count").notNull().default(0),
    /** 创建者用户名 */
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_topic_sources_created_by").on(table.createdBy),
  })
);

/**
 * 话题条目表
 *
 * 存储从数据源抓取的单个话题/新闻条目
 */
export const topicItems = pgTable(
  "topic_items",
  {
    /** 话题唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 来源数据源 ID */
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => topicSources.id, { onDelete: "cascade" }),
    /** 话题标题 */
    title: text("title").notNull(),
    /** 话题链接 */
    url: text("url").notNull(),
    /** 话题摘要 */
    summary: text("summary").notNull().default(""),
    /** 发布时间 */
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 相关性分数 */
    score: integer("score").notNull().default(0),
    /** 原始数据 JSON */
    rawJson: text("raw_json").notNull().default("{}"),
    /** 抓取时间 */
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index("idx_topic_items_source_id").on(table.sourceId),
  })
);

/**
 * 雷达话题表
 *
 * 存储用户创建的雷达话题，用于跟踪特定主题
 */
export const radarTopics = pgTable(
  "radar_topics",
  {
    /** 雷达话题唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 创建者用户名 */
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 话题类型 */
    kind: text("kind").notNull(),
    /** 话题标题 */
    title: text("title").notNull(),
    /** 话题摘要 */
    summary: text("summary").notNull().default(""),
    /** 话题详细内容 */
    content: text("content").notNull().default(""),
    /** 来源名称 */
    sourceName: text("source_name").notNull().default(""),
    /** 来源链接 */
    sourceUrl: text("source_url").notNull().default(""),
    /** 重要性分数 */
    score: integer("score").notNull().default(0),
    /** 标签 JSON 数组 */
    tagsJson: text("tags_json").notNull().default("[]"),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_topics_created_by").on(table.createdBy),
  })
);

/**
 * 雷达通知渠道表
 *
 * 存储雷达告警通知的 Webhook 渠道配置
 */
export const radarNotifications = pgTable(
  "radar_notifications",
  {
    /** 通知渠道唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 创建者用户名 */
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 通知类型（如 Discord、Slack 等） */
    type: text("type").notNull(),
    /** 通知渠道名称 */
    name: text("name").notNull(),
    /** Webhook URL */
    webhookUrl: text("webhook_url").notNull(),
    /** Webhook 密钥（用于签名验证） */
    secret: text("secret").notNull().default(""),
    /** 是否启用：1-启用，0-禁用 */
    enabled: integer("enabled").notNull().default(1),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_notifications_created_by").on(table.createdBy),
  })
);

/**
 * 雷达告警规则表
 *
 * 定义触发告警的条件规则
 */
export const radarAlertRules = pgTable(
  "radar_alert_rules",
  {
    /** 规则唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 创建者用户名 */
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 规则名称 */
    name: text("name").notNull(),
    /** 规则类型 */
    ruleType: text("rule_type").notNull(),
    /** 关键词匹配条件 */
    keyword: text("keyword").notNull().default(""),
    /** 数据源 ID 过滤条件 */
    sourceId: bigint("source_id", { mode: "number" }),
    /** 最小分数阈值 */
    minScore: integer("min_score").notNull().default(0),
    /** 通知渠道 ID */
    channelId: bigint("channel_id", { mode: "number" })
      .notNull()
      .references(() => radarNotifications.id, { onDelete: "cascade" }),
    /** 是否启用：1-启用，0-禁用 */
    enabled: integer("enabled").notNull().default(1),
    /** 创建时间 */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** 最后更新时间 */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_alert_rules_created_by").on(table.createdBy),
    channelIdx: index("idx_radar_alert_rules_channel_id").on(table.channelId),
  })
);

/**
 * 雷达告警日志表
 *
 * 记录告警发送的历史日志
 */
export const radarAlertLogs = pgTable(
  "radar_alert_logs",
  {
    /** 日志唯一标识 */
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** 创建者用户名 */
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    /** 触发的相关话题条目 ID */
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => topicItems.id, { onDelete: "cascade" }),
    /** 通知渠道 ID */
    channelId: bigint("channel_id", { mode: "number" })
      .notNull()
      .references(() => radarNotifications.id, { onDelete: "cascade" }),
    /** 触发的规则 ID */
    ruleId: bigint("rule_id", { mode: "number" })
      .notNull()
      .references(() => radarAlertRules.id, { onDelete: "cascade" }),
    /** 发送状态 */
    status: text("status").notNull(),
    /** 响应内容 */
    responseText: text("response_text").notNull().default(""),
    /** 错误信息 */
    errorText: text("error_text").notNull().default(""),
    /** 发送时间 */
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_alert_logs_created_by").on(table.createdBy),
    itemIdx: index("idx_radar_alert_logs_item_id").on(table.itemId),
  })
);

/**
 * Agent 目标表
 *
 * 记录目标驱动型 Agent 任务，区别于旧版 agent_runs 的“一次生成”语义。
 */
export const agentGoals = pgTable(
  "agent_goals",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    goal: text("goal").notNull(),
    taskType: text("task_type"),
    templateId: text("template_id"),
    status: text("status").notNull().default("planned"),
    executionMode: text("execution_mode").notNull().default("confirm"),
    requestedToolsJson: text("requested_tools_json").notNull().default("[]"),
    planJson: text("plan_json").notNull().default("{}"),
    summary: text("summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_agent_goals_username").on(table.username),
    createdAtIdx: index("idx_agent_goals_created_at").on(table.createdAt),
  })
);

/**
 * Agent 目标步骤表
 *
 * 统一记录规划、工具调用、审批节点和执行结果，作为 timeline 数据源。
 */
export const agentGoalSteps = pgTable(
  "agent_goal_steps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => agentGoals.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("pending"),
    inputJson: text("input_json").notNull().default("{}"),
    outputJson: text("output_json").notNull().default("{}"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  },
  (table) => ({
    goalIdx: index("idx_agent_goal_steps_goal_id").on(table.goalId),
  })
);

/**
 * Agent 审批表
 *
 * 高风险操作必须进入审批，执行时只能消费 approved 状态的审批记录。
 */
export const agentApprovals = pgTable(
  "agent_approvals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => agentGoals.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    action: text("action").notNull(),
    riskLevel: text("risk_level").notNull(),
    status: text("status").notNull().default("pending"),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  },
  (table) => ({
    goalIdx: index("idx_agent_approvals_goal_id").on(table.goalId),
  })
);

/**
 * 知识文档表
 *
 * 保存原始知识文档和元数据，便于后续重建切块或升级为向量索引。
 */
export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    status: text("status").notNull().default("indexed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_knowledge_documents_username").on(table.username),
    createdAtIdx: index("idx_knowledge_documents_created_at").on(table.createdAt),
  })
);

/**
 * 知识切块表
 *
 * 第一阶段先做词法检索，后续可以在此基础上补 embedding / vector 列。
 */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("idx_knowledge_chunks_document_id").on(table.documentId),
    chunkIdx: index("idx_knowledge_chunks_chunk_index").on(table.chunkIndex),
  })
);

/**
 * Prompt 模板表
 *
 * 存储服务端 Prompt 模板和版本，替代仅在浏览器 localStorage 中保存。
 */
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    scenario: text("scenario").notNull(),
    name: text("name").notNull(),
    assistantName: text("assistant_name").notNull().default(""),
    version: integer("version").notNull().default(1),
    systemPrompt: text("system_prompt").notNull().default(""),
    taskPrompt: text("task_prompt").notNull().default(""),
    toolPrompt: text("tool_prompt").notNull().default(""),
    outputSchemaPrompt: text("output_schema_prompt").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_prompt_templates_username").on(table.username),
    scenarioIdx: index("idx_prompt_templates_scenario").on(table.scenario),
  })
);

/**
 * Prompt 测试记录表
 *
 * 用于离线评测不同 prompt 版本和模型的响应表现。
 */
export const promptTestRuns = pgTable(
  "prompt_test_runs",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => promptTemplates.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    inputJson: text("input_json").notNull().default("{}"),
    outputJson: text("output_json").notNull().default("{}"),
    score: integer("score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_prompt_test_runs_username").on(table.username),
    templateIdx: index("idx_prompt_test_runs_template_id").on(table.templateId),
  })
);

export const contentDeliveries = pgTable(
  "content_deliveries",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => agentGoals.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    targetUrl: text("target_url").notNull(),
    status: text("status").notNull().default("pending"),
    payloadJson: text("payload_json").notNull().default("{}"),
    responseCode: integer("response_code"),
    responseBodyPreview: text("response_body_preview").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_content_deliveries_username").on(table.username),
    goalIdx: index("idx_content_deliveries_goal_id").on(table.goalId),
    createdAtIdx: index("idx_content_deliveries_created_at").on(table.createdAt),
  })
);
