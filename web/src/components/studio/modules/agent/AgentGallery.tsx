"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";

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
    queryKey: queryKeys.agentGallery,
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
  const error =
    galleryQuery.error instanceof Error ? "作品库加载失败，请稍后重试" : "";
  const hasItems = items.length > 0;

  return (
    <div className="agent-gallery-page">
      <div className="studio-section-head">
        <div>
          <h3 className="agent-panel-title">作品库</h3>
          <p className="agent-panel-desc">展示 AI 已生成的文章结果。</p>
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-secondary"
          onClick={() => void galleryQuery.refetch()}
          disabled={galleryQuery.isFetching}
        >
          {galleryQuery.isFetching ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && <div className="studio-status studio-status-error">{error}</div>}

      {!hasItems && !galleryQuery.isLoading && !error && (
        <div className="studio-empty">暂无可展示作品</div>
      )}

      {galleryQuery.isLoading && !hasItems && (
        <div className="studio-empty">正在加载作品...</div>
      )}

      {hasItems && (
        <div className="agent-gallery-grid">
          {items.map((item) => (
            <article key={item.runId} className="agent-gallery-card">
              <h4>{item.title}</h4>
              <p>{excerpt(item.content)}</p>

              <div className="agent-gallery-meta">
                <span>{formatDateTime(item.updatedAt)}</span>
                <span>{item.model}</span>
              </div>

              {item.tags && (
                <div className="agent-gallery-tags">
                  #{item.tags.replace(/,/g, " #")}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
