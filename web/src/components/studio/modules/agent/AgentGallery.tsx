"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";

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
  const { token } = useAuth();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadGallery() {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const listRes = await fetch("/api/agent/runs?page=1&size=30", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = await listRes.json().catch(() => ({}));
      const runs = ((listData?.data?.items || []) as RunListItem[]).filter((run) => run.status === "done");

      const topRuns = runs.slice(0, 16);
      const details = await Promise.all(
        topRuns.map(async (run) => {
          const detailRes = await fetch(`/api/agent/runs/${run.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const detailData = await detailRes.json().catch(() => ({}));
          if (!detailRes.ok || !detailData?.success) return null;
          const artifacts = (detailData?.data?.artifacts || []) as Artifact[];

          const title = getArtifactText(artifacts, "title") || run.goal || "未命名作品";
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

      setItems(details.filter(Boolean) as GalleryItem[]);
    } catch {
      setError("作品库加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGallery();
  }, [token]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <div className="agent-gallery-page">
      <div className="studio-section-head">
        <div>
          <h3 className="agent-panel-title">作品库</h3>
          <p className="agent-panel-desc">展示 AI 已生成的文章结果。</p>
        </div>
        <button type="button" className="studio-btn studio-btn-secondary" onClick={loadGallery} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && <div className="studio-status studio-status-error">{error}</div>}

      {!hasItems && !loading && !error && <div className="studio-empty">暂无可展示作品</div>}

      {loading && !hasItems && <div className="studio-empty">正在加载作品...</div>}

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

              {item.tags && <div className="agent-gallery-tags">#{item.tags.replace(/,/g, " #")}</div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
