/**
 * Format date for agent display (relative or absolute)
 */
export function formatAgentDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Less than 1 minute ago
  if (diffMins < 1) {
    return "刚刚";
  }

  // Less than 1 hour ago
  if (diffHours < 1) {
    return `${diffMins} 分钟前`;
  }

  // Less than 24 hours ago
  if (diffDays < 1) {
    return `${diffHours} 小时前`;
  }

  // Less than 7 days ago
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  // Otherwise show absolute date
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Truncate text at word boundary
 */
export function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    return `${truncated.slice(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format task type for display
 */
export function formatTaskType(taskType: string): string {
  const taskTypeLabels: Record<string, string> = {
    general_assistant: "通用对话",
    hot_topic_article: "热点文章",
    continue_article: "续写文章",
    article_to_video: "视频脚本",
    publish_draft: "发布草稿",
  };
  return taskTypeLabels[taskType] || taskType;
}

/**
 * Format goal status for display
 */
export function formatGoalStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    planned: "已规划",
    waiting_approval: "等待确认",
    running: "执行中",
    done: "已完成",
    failed: "执行失败",
  };
  return statusLabels[status] || status;
}
