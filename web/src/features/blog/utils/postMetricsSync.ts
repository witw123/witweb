"use client";

export const POST_METRICS_UPDATED_EVENT = "post-metrics-updated";

export type PostMetricsUpdateDetail = {
  slug: string;
  like_count?: number;
  dislike_count?: number;
  favorite_count?: number;
  comment_count?: number;
  favorited_by_me?: boolean;
};

export function emitPostMetricsUpdated(detail: PostMetricsUpdateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PostMetricsUpdateDetail>(POST_METRICS_UPDATED_EVENT, { detail }));
}

