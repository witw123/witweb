/**
 * React Query 查询键定义
 *
 * 用于缓存和无效化查询
 */

/** 查询键工厂 */
export const queryKeys = {
  categories: ["categories"] as const,
  tags: (limit: number) => ["tags", limit] as const,
  postsList: (filters: {
    page: number;
    pageSize: number;
    query?: string;
    author?: string;
    tag?: string;
    category?: string;
  }) =>
    [
      "posts-list",
      filters.page,
      filters.pageSize,
      filters.query || "",
      filters.author || "",
      filters.tag || "",
      filters.category || "",
    ] as const,
  favorites: (page: number, pageSize: number) =>
    ["favorites", page, pageSize] as const,
  followers: (scope: string) => ["followers", scope] as const,
  following: (scope: string) => ["following", scope] as const,
  postDetail: (slug: string) => ["post-detail", slug] as const,
  postComments: (slug: string) => ["post-comments", slug] as const,
  messageConversations: ["message-conversations"] as const,
  messageNotifications: (type: string) => ["message-notifications", type] as const,
  messageMessages: (conversationId: number | null) => ["message-messages", conversationId] as const,
  agentRuns: ["agent-runs"] as const,
  agentRunDetail: (runId: string) => ["agent-run-detail", runId] as const,
  agentGallery: ["agent-gallery"] as const,
  agentGoalTimeline: (goalId: string | null) => ["agent-goal-timeline", goalId || ""] as const,
  agentTools: ["agent-tools"] as const,
  modelRegistry: ["model-registry"] as const,
  promptTemplates: (scenario?: string) => ["prompt-templates", scenario || "all"] as const,
  videoConfig: ["video-config"] as const,
  videoOutputs: ["video-outputs"] as const,
  videoTasks: (filters?: { limit?: number; taskType?: string; status?: string }) =>
    [
      "video-tasks",
      filters?.limit || 20,
      filters?.taskType || "",
      filters?.status || "",
    ] as const,
  videoTaskDetail: (taskId: string) => ["video-task-detail", taskId] as const,
  radarSources: ["radar-sources"] as const,
  radarItems: (filters?: { q?: string; sourceId?: number | null; limit?: number }) =>
    [
      "radar-items",
      filters?.q || "",
      filters?.sourceId || 0,
      filters?.limit || 120,
    ] as const,
  radarTopics: (filters?: { q?: string; kind?: string; limit?: number }) =>
    [
      "radar-topics",
      filters?.q || "",
      filters?.kind || "",
      filters?.limit || 120,
    ] as const,
  adminBlogs: (filters: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    username?: string;
    tag?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }) =>
    [
      "admin-blogs",
      filters.page,
      filters.limit,
      filters.search || "",
      filters.status || "",
      filters.username || "",
      filters.tag || "",
      filters.dateFrom || "",
      filters.dateTo || "",
      filters.sort || "",
    ] as const,
  adminCategories: ["admin-categories"] as const,
  adminUsers: (filters: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    activity?: string;
    sort?: string;
  }) =>
    [
      "admin-users",
      filters.page,
      filters.limit,
      filters.search || "",
      filters.role || "",
      filters.activity || "",
      filters.sort || "",
    ] as const,
  adminPermissions: ["admin-permissions"] as const,
  adminFriendLinks: ["admin-friend-links"] as const,
  adminAuditLogs: (filters: {
    page: number;
    size: number;
    actor?: string;
    action?: string;
    targetType?: string;
  }) =>
    [
      "admin-audit-logs",
      filters.page,
      filters.size,
      filters.actor || "",
      filters.action || "",
      filters.targetType || "",
    ] as const,
} as const;
