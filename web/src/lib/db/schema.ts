import { sql } from "drizzle-orm";
import { bigserial, bigint, doublePrecision, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  balance: doublePrecision("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  lastReadNotificationsAt: timestamp("last_read_notifications_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`'1970-01-01 00:00:00+00'`),
  isBot: integer("is_bot").notNull().default(0),
});

export const categories = pgTable(
  "categories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    sortOrderIdx: index("idx_categories_sort_order").on(table.sortOrder),
  })
);

export const posts = pgTable(
  "posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    author: text("author")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    tags: text("tags"),
    status: text("status").notNull().default("published"),
    categoryId: bigint("category_id", { mode: "number" }).references(() => categories.id, {
      onDelete: "set null",
    }),
    viewCount: integer("view_count").notNull().default(0),
  },
  (table) => ({
    authorIdx: index("idx_posts_author").on(table.author),
    createdAtIdx: index("idx_posts_created_at").on(table.createdAt),
    categoryIdIdx: index("idx_posts_category_id").on(table.categoryId),
  })
);

export const comments = pgTable(
  "comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    author: text("author")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    parentId: bigint("parent_id", { mode: "number" }),
    ipAddress: text("ip_address"),
  },
  (table) => ({
    postIdx: index("idx_comments_post").on(table.postId),
    createdAtIdx: index("idx_comments_created_at").on(table.createdAt),
  })
);

export const likes = pgTable(
  "likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_likes_post").on(table.postId),
    usernameIdx: index("idx_likes_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

export const dislikes = pgTable(
  "dislikes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_dislikes_post").on(table.postId),
    usernameIdx: index("idx_dislikes_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

export const favorites = pgTable(
  "favorites",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_favorites_post").on(table.postId),
    usernameIdx: index("idx_favorites_username").on(table.username),
    postUserUnique: unique().on(table.postId, table.username),
  })
);

export const commentVotes = pgTable(
  "comment_votes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    commentId: bigint("comment_id", { mode: "number" })
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    value: integer("value").notNull(),
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

export const follows = pgTable(
  "follows",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    follower: text("follower")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    following: text("following")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    followerFollowingUnique: unique().on(table.follower, table.following),
    followerIdx: index("idx_follows_follower").on(table.follower),
    followingIdx: index("idx_follows_following").on(table.following),
  })
);

export const conversations = pgTable(
  "conversations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    user1: text("user1")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    user2: text("user2")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    lastMessage: text("last_message"),
    lastTime: timestamp("last_time", { withTimezone: true, mode: "string" }),
    unreadCountUser1: integer("unread_count_user1").notNull().default(0),
    unreadCountUser2: integer("unread_count_user2").notNull().default(0),
  },
  (table) => ({
    user1Idx: index("idx_conversations_user1").on(table.user1),
    user2Idx: index("idx_conversations_user2").on(table.user2),
  })
);

export const privateMessages = pgTable(
  "private_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: text("sender")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    receiver: text("receiver")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isRead: integer("is_read").notNull().default(0),
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

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    username: text("username")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    goal: text("goal").notNull(),
    agentType: text("agent_type").notNull(),
    status: text("status").notNull(),
    model: text("model").notNull(),
    errorMessage: text("error_message").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameIdx: index("idx_agent_runs_username").on(table.username),
    createdAtIdx: index("idx_agent_runs_created_at").on(table.createdAt),
  })
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    stepTitle: text("step_title").notNull(),
    status: text("status").notNull(),
    inputJson: text("input_json").notNull().default(""),
    outputJson: text("output_json").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  },
  (table) => ({
    runIdx: index("idx_agent_steps_run_id").on(table.runId),
  })
);

export const agentArtifacts = pgTable(
  "agent_artifacts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    metaJson: text("meta_json").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("idx_agent_artifacts_run_id").on(table.runId),
    kindIdx: index("idx_agent_artifacts_kind").on(table.kind),
  })
);

export const topicSources = pgTable(
  "topic_sources",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    type: text("type").notNull(),
    parserConfigJson: text("parser_config_json").notNull().default("{}"),
    enabled: integer("enabled").notNull().default(1),
    lastFetchStatus: text("last_fetch_status").notNull().default("idle"),
    lastFetchError: text("last_fetch_error").notNull().default(""),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true, mode: "string" }),
    lastFetchCount: integer("last_fetch_count").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_topic_sources_created_by").on(table.createdBy),
  })
);

export const topicItems = pgTable(
  "topic_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => topicSources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    summary: text("summary").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    score: integer("score").notNull().default(0),
    rawJson: text("raw_json").notNull().default("{}"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdx: index("idx_topic_items_source_id").on(table.sourceId),
  })
);

export const radarTopics = pgTable(
  "radar_topics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    score: integer("score").notNull().default(0),
    tagsJson: text("tags_json").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_topics_created_by").on(table.createdBy),
  })
);

export const radarNotifications = pgTable(
  "radar_notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    webhookUrl: text("webhook_url").notNull(),
    secret: text("secret").notNull().default(""),
    enabled: integer("enabled").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_notifications_created_by").on(table.createdBy),
  })
);

export const radarAlertRules = pgTable(
  "radar_alert_rules",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ruleType: text("rule_type").notNull(),
    keyword: text("keyword").notNull().default(""),
    sourceId: bigint("source_id", { mode: "number" }),
    minScore: integer("min_score").notNull().default(0),
    channelId: bigint("channel_id", { mode: "number" })
      .notNull()
      .references(() => radarNotifications.id, { onDelete: "cascade" }),
    enabled: integer("enabled").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_alert_rules_created_by").on(table.createdBy),
    channelIdx: index("idx_radar_alert_rules_channel_id").on(table.channelId),
  })
);

export const radarAlertLogs = pgTable(
  "radar_alert_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.username, { onDelete: "cascade" }),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => topicItems.id, { onDelete: "cascade" }),
    channelId: bigint("channel_id", { mode: "number" })
      .notNull()
      .references(() => radarNotifications.id, { onDelete: "cascade" }),
    ruleId: bigint("rule_id", { mode: "number" })
      .notNull()
      .references(() => radarAlertRules.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    responseText: text("response_text").notNull().default(""),
    errorText: text("error_text").notNull().default(""),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => ({
    createdByIdx: index("idx_radar_alert_logs_created_by").on(table.createdBy),
    itemIdx: index("idx_radar_alert_logs_item_id").on(table.itemId),
  })
);
