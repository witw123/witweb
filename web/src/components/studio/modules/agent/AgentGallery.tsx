"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { SubPageHeader } from "@/features/agent/components/SubPageHeader";
import type { AgentGalleryItem } from "@/features/agent/types";

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function excerpt(markdown: string, max = 180) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_\-\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "暂无正文内容";
  return plain.length > max ? `${plain.slice(0, max)}...` : plain;
}

function taskTypeLabel(taskType?: string | null) {
  const mapping: Record<string, string> = {
    hot_topic_article: "热点文章",
    continue_article: "续写草稿",
    article_to_video: "视频提示词",
    publish_draft: "发布草稿",
  };
  return taskType ? mapping[taskType] || taskType : "执行结果";
}

function sourceLabel(source: AgentGalleryItem["source"]) {
  if (source === "post_draft") return "已保存草稿";
  if (source === "video_prompt") return "视频提示词";
  return "执行结果";
}

function buildThreadHref(item: AgentGalleryItem) {
  return item.conversation_id
    ? `/agent?conversationId=${item.conversation_id}`
    : `/agent?goalId=${item.goal_id}`;
}

export function AgentGallery() {
  const { isAuthenticated } = useAuth();

  const galleryQuery = useQuery({
    queryKey: ["agent-gallery"],
    queryFn: async () =>
      get<{ items: AgentGalleryItem[] }>(`${getVersionedApiPath("/agent/goals")}?status=done&size=24`),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const items = useMemo(() => galleryQuery.data?.items || [], [galleryQuery.data]);
  const error = galleryQuery.error instanceof Error ? "作品库加载失败，请稍后重试" : "";
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#0a0a0a] overflow-hidden">
      <div className="p-6 md:p-8 lg:px-12 max-w-7xl mx-auto w-full flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <SubPageHeader
          title="作品库画廊"
          description="展示 AI 代理基于 goals / conversations 执行后沉淀的文章草稿与视频提示词。"
          action={
            <button
              type="button"
              className="studio-btn studio-btn-secondary"
              onClick={() => void galleryQuery.refetch()}
              disabled={galleryQuery.isFetching}
            >
              {galleryQuery.isFetching ? "刷新中..." : "刷新列表"}
            </button>
          }
        />

        {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">{error}</div>}

        {!hasItems && !galleryQuery.isLoading && !error && (
          <div className="studio-empty bg-white/5 border border-white/5 p-12 text-center rounded-xl text-zinc-400">暂无可展示作品</div>
        )}

        {galleryQuery.isLoading && !hasItems && (
          <div className="studio-empty bg-white/5 border border-white/5 p-12 text-center rounded-xl text-zinc-400">正在加载作品...</div>
        )}

        {hasItems && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item) => (
              <Link
                key={item.goal_id}
                href={buildThreadHref(item)}
                className="group flex flex-col bg-gradient-to-b from-[#11141c]/90 to-[#0a0c11]/90 border border-white/5 rounded-2xl p-5 gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#3882f6]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] min-h-[260px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="bg-[#3882f6]/10 px-2 py-1 rounded border border-[#3882f6]/20 text-[10px] uppercase tracking-wide text-[#a5c6f7]">
                    {taskTypeLabel(item.task_type)}
                  </span>
                  <span className="text-[10px] text-zinc-500">{sourceLabel(item.source)}</span>
                </div>

                <h4 className="text-[17px] font-bold text-[#f2f5fe] leading-snug line-clamp-2" title={item.title}>
                  {item.title}
                </h4>

                <p className="text-[13px] leading-relaxed text-[#8896b0] line-clamp-4 flex-1">
                  {excerpt(item.preview.content || item.preview.video_prompt || item.summary)}
                </p>

                <div className="flex items-center justify-between text-[11px] text-[#4d5b7a] mt-auto pt-4 border-t border-white/5">
                  <span className="bg-black/30 px-2 py-1 rounded text-zinc-400">{item.status}</span>
                  <span>{formatDateTime(item.updated_at)}</span>
                </div>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md bg-[#3882f6]/10 text-[#a5c6f7] text-[10px] whitespace-nowrap border border-[#3882f6]/20">
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800/50 text-zinc-400 text-[10px]">...</span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
