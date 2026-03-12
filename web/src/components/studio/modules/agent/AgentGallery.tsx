"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { SubPageHeader } from "@/features/agent/components/SubPageHeader";

type RunListItem = {
  id: string;
  goal: string;
  status: string;
  model?: string;
  updated_at: string;
};

type Artifact = {
  id: number;
  kind: "title" | "content" | "tags" | "seo" | "cover_prompt";
  content: string;
};

type GalleryItem = {
  runId: string;
  title: string;
  content: string;
  tags: string;
  updatedAt: string;
  model: string;
};

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function getArtifactText(artifacts: Artifact[], kind: Artifact["kind"]) {
  return artifacts.find((item) => item.kind === kind)?.content?.trim() || "";
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

export function AgentGallery() {
  const { isAuthenticated } = useAuth();

  const galleryQuery = useQuery({
    queryKey: ["agent-gallery"],
    queryFn: async () => {
      const listData = await get<{ items: RunListItem[] }>(
        `${getVersionedApiPath("/agent/runs")}?page=1&size=30`
      );

      const runs = (Array.isArray(listData.items) ? listData.items : []).filter(
        (run) => run.status === "done"
      );

      const details = await Promise.all(
        runs.slice(0, 16).map(async (run) => {
          const detailData = await get<{ artifacts: Artifact[] }>(
            getVersionedApiPath(`/agent/runs/${run.id}`)
          );
          const artifacts = Array.isArray(detailData.artifacts)
            ? detailData.artifacts
            : [];

          const title =
            getArtifactText(artifacts, "title") || run.goal || "未命名作品";
          const content = getArtifactText(artifacts, "content");
          const tags = getArtifactText(artifacts, "tags");

          if (!content) return null;

          return {
            runId: run.id,
            title,
            content,
            tags,
            updatedAt: run.updated_at,
            model: run.model || "--",
          } as GalleryItem;
        })
      );

      return details.filter(Boolean) as GalleryItem[];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const items = useMemo(() => galleryQuery.data || [], [galleryQuery.data]);
  const error = galleryQuery.error instanceof Error ? "作品库加载失败，请稍后重试" : "";
  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#0a0a0a] overflow-hidden">
      <div className="p-6 md:p-8 lg:px-12 max-w-7xl mx-auto w-full flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <SubPageHeader
          title="作品库画廊"
          description="展示 AI 代理经过计划与执行后最终生成的文章与素材卡片。"
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
              <article
                key={item.runId}
                className="group flex flex-col bg-gradient-to-b from-[#11141c]/90 to-[#0a0c11]/90 border border-white/5 rounded-2xl p-5 gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#3882f6]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] min-h-[260px]"
              >
                <h4 className="text-[17px] font-bold text-[#f2f5fe] leading-snug line-clamp-2" title={item.title}>
                  {item.title}
                </h4>
                <p className="text-[13px] leading-relaxed text-[#8896b0] line-clamp-4 flex-1">
                  {excerpt(item.content)}
                </p>

                <div className="flex items-center justify-between text-[11px] text-[#4d5b7a] mt-auto pt-4 border-t border-white/5">
                  <span className="bg-black/30 px-2 py-1 rounded text-zinc-400">{item.model}</span>
                  <span>{formatDateTime(item.updatedAt)}</span>
                </div>

                {item.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.tags.split(',').slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md bg-[#3882f6]/10 text-[#a5c6f7] text-[10px] whitespace-nowrap border border-[#3882f6]/20">
                        {tag.trim()}
                      </span>
                    ))}
                    {item.tags.split(',').length > 3 && (
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800/50 text-zinc-400 text-[10px]">...</span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
