"use client";

/**
 * 文章指标同步工具
 *
 * 用于在组件间同步文章指标（点赞、踩、收藏、评论数）变化
 */

export const POST_METRICS_UPDATED_EVENT = "post-metrics-updated";

/** 文章指标更新详情 */
export type PostMetricsUpdateDetail = {
  slug: string;
  like_count?: number;
  dislike_count?: number;
  favorite_count?: number;
  comment_count?: number;
  favorited_by_me?: boolean;
};

/**
 * 发送文章指标更新事件
 *
 * @param {PostMetricsUpdateDetail} detail - 更新详情
 */
export function emitPostMetricsUpdated(detail: PostMetricsUpdateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PostMetricsUpdateDetail>(POST_METRICS_UPDATED_EVENT, { detail }));
}

