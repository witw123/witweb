"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";
import { useRouter } from "next/navigation";

type RadarSource = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "html" | "api";
  parser_config_json?: string;
  enabled: number;
  last_fetch_status?: "idle" | "ok" | "failed";
  last_fetch_error?: string;
  last_fetched_at?: string | null;
  last_fetch_count?: number;
  updated_at: string;
};

type RadarItem = {
  id: number;
  source_id: number;
  source_name: string;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  score: number;
};

type RadarTab = "discover" | "sources" | "automation" | "library";

type RadarAnalysisResult = {
  summary: string;
  keywords: string[];
  angles: string[];
  risks: string[];
  markdown: string;
};

type RadarTopic = {
  id: number;
  kind: "item" | "analysis";
  title: string;
  summary: string;
  content: string;
  source_name: string;
  source_url: string;
  score: number;
  tags?: string[];
  created_at: string;
};

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function sourceHealthText(source: RadarSource) {
  const status = source.last_fetch_status || "idle";
  if (status === "ok") {
    const at = source.last_fetched_at ? formatDate(source.last_fetched_at) : "--";
    const count = Number(source.last_fetch_count || 0);
    return `最近成功 ${at} · ${count} 条`;
  }
  if (status === "failed") {
    const err = (source.last_fetch_error || "unknown_error").slice(0, 80);
    return `最近失败 · ${err}`;
  }
  return "尚未抓取";
}

export function RadarLayout() {
  const { token, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const authHeaders = useMemo<Record<string, string>>(() => {
    if (token) return { Authorization: `Bearer ${token}` } as Record<string, string>;
    return {} as Record<string, string>;
  }, [token]);

  const [tab, setTab] = useState<RadarTab>("discover");
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [items, setItems] = useState<RadarItem[]>([]);
  const [analysis, setAnalysis] = useState<RadarAnalysisResult | null>(null);
  const [topics, setTopics] = useState<RadarTopic[]>([]);

  const [q, setQ] = useState("");
  const [topicQ, setTopicQ] = useState("");
  const [analysisQ, setAnalysisQ] = useState("");
  const [analysisFocus, setAnalysisFocus] = useState("");
  const [analysisLimit, setAnalysisLimit] = useState("30");

  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "html" | "api">("rss");
  const [sourceParser, setSourceParser] = useState("");
  const [sourceEnabled, setSourceEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sourceList = useMemo(() => [...sources].sort((a, b) => b.enabled - a.enabled), [sources]);

  const selectedSource = useMemo(
    () => sourceList.find((item) => item.id === selectedSourceId) || null,
    [sourceList, selectedSourceId]
  );
  function handleUnauthorized() {
    setError("登录已失效，请重新登录");
    logout();
    router.push("/login");
  }

  function resetSourceForm() {
    setSelectedSourceId(null);
    setSourceName("");
    setSourceUrl("");
    setSourceType("rss");
    setSourceParser("");
    setSourceEnabled(true);
  }

  async function loadSources() {
    const res = await fetch("/api/radar/sources", { headers: authHeaders });
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      const list = data.data.items || [];
      setSources(list);
      if (list.length > 0 && (selectedSourceId == null || !list.some((item: RadarSource) => item.id === selectedSourceId))) {
        setSelectedSourceId(list[0].id);
      }
      if (list.length === 0) resetSourceForm();
    }
  }

  async function loadItems(keyword = q) {
    const params = new URLSearchParams();
    params.set("limit", "120");
    if (keyword.trim()) params.set("q", keyword.trim());

    const res = await fetch(`/api/radar/items?${params.toString()}`, { headers: authHeaders });
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setItems(data.data.items || []);
  }

  async function loadTopics(keyword = topicQ) {
    const params = new URLSearchParams();
    params.set("limit", "120");
    if (keyword.trim()) params.set("q", keyword.trim());

    const res = await fetch(`/api/radar/topics?${params.toString()}`, { headers: authHeaders });
    if (res.status === 401) return handleUnauthorized();
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setTopics(data.data.items || []);
  }

  async function initialize() {
    if (authLoading || !token) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadSources(), loadItems(""), loadTopics("")]);
    } catch {
      setError("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void initialize();
  }, [token, authLoading]);

  useEffect(() => {
    if (!selectedSource) return;
    setSourceName(selectedSource.name);
    setSourceUrl(selectedSource.url);
    setSourceType(selectedSource.type);
    setSourceParser(selectedSource.parser_config_json || "{}");
    setSourceEnabled(selectedSource.enabled === 1);
  }, [selectedSourceId, selectedSource]);

  async function saveSource() {
    if (!sourceName.trim() || !sourceUrl.trim()) return;
    setError("");

    if (sourceParser.trim()) {
      try {
        JSON.parse(sourceParser);
      } catch {
        setError("Parser 配置必须是合法 JSON");
        return;
      }
    }

    const body = {
      name: sourceName.trim(),
      url: sourceUrl.trim(),
      type: sourceType,
      parser_config_json: sourceParser.trim() || "{}",
      enabled: sourceEnabled,
    };

    const endpoint = selectedSourceId ? `/api/radar/sources/${selectedSourceId}` : "/api/radar/sources";
    const method = selectedSourceId ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setError(data?.error?.message || "保存来源失败");
      return;
    }

    await loadSources();
  }

  async function removeSource(sourceId: number) {
    await fetch(`/api/radar/sources/${sourceId}`, { method: "DELETE", headers: authHeaders });
    await loadSources();
  }

  async function fetchNow(sourceId?: number) {
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/radar/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(sourceId ? { source_id: sourceId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "抓取失败，请检查来源可达性");
        return;
      }
      await Promise.all([loadItems()]);
    } catch {
      setError("抓取失败，请检查来源可达性");
    } finally {
      setFetching(false);
    }
  }

  async function search() {
    await loadItems(q);
  }

  async function clearItems() {
    const ok = window.confirm("确认清空热点列表吗？此操作会删除当前账号的雷达抓取结果。");
    if (!ok) return;

    const res = await fetch("/api/radar/items", { method: "DELETE", headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      setError(data?.error?.message || "清空失败，请稍后重试");
      return;
    }
    setItems([]);
    setAnalysis(null);
  }

  async function saveTopicFromItem(item: RadarItem) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/radar/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          kind: "item",
          title: item.title,
          summary: item.summary,
          source_name: item.source_name,
          source_url: item.url,
          score: item.score,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "保存选题失败");
        return;
      }
      await loadTopics();
    } catch {
      setError("保存选题失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setError("");
    try {
      const limit = Number(analysisLimit || "30");
      const res = await fetch("/api/radar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          limit: Number.isFinite(limit) ? limit : 30,
          q: analysisQ.trim() || undefined,
          focus: analysisFocus.trim() || undefined,
          source_id: selectedSourceId || undefined,
        }),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "AI 分析失败");
        return;
      }
      setAnalysis(data.data.analysis || null);
    } catch {
      setError("AI 分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAnalysisTopic() {
    if (!analysis) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/radar/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          kind: "analysis",
          title: `AI 分析结论 ${new Date().toLocaleDateString("zh-CN")}`,
          summary: analysis.summary,
          content: analysis.markdown,
          source_name: selectedSource?.name || "全部来源",
          source_url: "",
          score: 0,
          tags: analysis.keywords,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "保存分析失败");
        return;
      }
      await loadTopics();
      setTab("library");
    } catch {
      setError("保存分析失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function removeTopic(topicId: number) {
    const ok = window.confirm("确认删除这个已保存选题吗？");
    if (!ok) return;
    setError("");
    await fetch(`/api/radar/topics/${topicId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    await loadTopics();
  }

  async function searchTopics() {
    await loadTopics(topicQ);
  }

  const stats = useMemo(() => {
    const enabledSources = sources.filter((item) => item.enabled === 1).length;
    return {
      sources: sources.length,
      enabledSources,
      items: items.length,
      analyzed: analysis ? 1 : 0,
      selectedSource: selectedSourceId ? 1 : 0,
      topics: topics.length,
    };
  }, [sources, items, analysis, selectedSourceId, topics]);

  return (
    <section className="radar-shell radar-shell-v2">
      <div className="studio-section-head radar-head-v2">
        <div>
          <h2 className="agent-title">选题雷达</h2>
          <p className="agent-subtitle">抓取热点，筛选选题，并用 AI 直接产出分析结论。</p>
        </div>
        <div className="radar-head-actions">
          <button className="studio-btn studio-btn-secondary" onClick={() => initialize()} disabled={loading}>刷新</button>
          <button className="studio-btn studio-btn-primary" onClick={() => fetchNow()} disabled={fetching || loading}>{fetching ? "抓取中..." : "抓取全部来源"}</button>
        </div>
      </div>

      <div className="radar-kpi-grid">
        <div className="radar-kpi-card"><span>来源</span><strong>{stats.sources}</strong><em>启用 {stats.enabledSources}</em></div>
        <div className="radar-kpi-card"><span>热点条目</span><strong>{stats.items}</strong><em>可筛选导出</em></div>
        <div className="radar-kpi-card"><span>AI 分析</span><strong>{stats.analyzed ? "已生成" : "未生成"}</strong><em>按热点自动归纳</em></div>
        <div className="radar-kpi-card"><span>选题库</span><strong>{stats.topics}</strong><em>{stats.selectedSource ? "单来源" : "全部来源"} 视图可切换</em></div>
      </div>

      <div className="radar-tabbar-v2">
        <button className={`radar-tab-v2 ${tab === "discover" ? "is-active" : ""}`} onClick={() => setTab("discover")}>发现</button>
        <button className={`radar-tab-v2 ${tab === "sources" ? "is-active" : ""}`} onClick={() => setTab("sources")}>来源</button>
        <button className={`radar-tab-v2 ${tab === "automation" ? "is-active" : ""}`} onClick={() => setTab("automation")}>AI 分析</button>
        <button className={`radar-tab-v2 ${tab === "library" ? "is-active" : ""}`} onClick={() => setTab("library")}>选题库</button>
      </div>

      {error && <div className="studio-status studio-status-error">{error}</div>}

      {tab === "discover" && (
        <section className="studio-panel studio-panel-glass">
          <h3 className="studio-title-3">热点发现</h3>
          <div className="radar-action-row mt-3">
            <input className="studio-input" placeholder="按关键词筛选标题/摘要" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="studio-btn studio-btn-secondary" onClick={search}>筛选</button>
            <button className="studio-btn studio-btn-secondary" onClick={clearItems}>清空热点</button>
          </div>

          <div className="mt-4 space-y-3">
            {items.length === 0 && <div className="text-sm text-zinc-500">暂无热点，先抓取来源</div>}
            {items.map((item) => (
              <article key={item.id} className="radar-item-card">
                <a href={item.url} target="_blank" rel="noreferrer" className="radar-item-title">{item.title}</a>
                <p className="radar-item-summary">{item.summary || "暂无摘要"}</p>
                <div className="radar-item-meta">
                  <span>{item.source_name}</span>
                  <span>热度 {Math.round(item.score)}</span>
                  <span>{formatDate(item.published_at)}</span>
                </div>
                <div className="radar-item-actions">
                  <button className="studio-btn studio-btn-secondary" onClick={() => saveTopicFromItem(item)} disabled={saving}>
                    保存选题
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "sources" && (
        <div className="radar-split-grid">
          <section className="studio-panel studio-panel-glass radar-list-panel">
            <div className="radar-list-head">
              <h3 className="studio-title-3">来源列表</h3>
              <button className="studio-btn studio-btn-secondary" onClick={resetSourceForm}>新建</button>
            </div>
            <div className="mt-3 space-y-2">
              {sourceList.length === 0 && <div className="text-sm text-zinc-500">暂无来源</div>}
              {sourceList.map((source) => (
                <button key={source.id} className={`radar-list-item ${selectedSourceId === source.id ? "is-active" : ""}`} onClick={() => setSelectedSourceId(source.id)}>
                  <span className="title">{source.name}</span>
                  <span className="meta">{source.type.toUpperCase()} · {source.enabled ? "启用" : "停用"}</span>
                  <span className={`meta ${source.last_fetch_status === "failed" ? "is-failed" : source.last_fetch_status === "ok" ? "is-ok" : ""}`}>
                    {sourceHealthText(source)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="studio-panel studio-panel-glass radar-detail-panel">
            <h3 className="studio-title-3">{selectedSourceId ? "编辑来源" : "新增来源"}</h3>
            <div className="mt-3 space-y-2">
              <input className="studio-input" placeholder="来源名称" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
              <input className="studio-input" placeholder="来源链接（https://...）" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              <select className="studio-input" value={sourceType} onChange={(e) => setSourceType(e.target.value as "rss" | "html" | "api") }>
                <option value="rss">RSS 抓取</option>
                <option value="html">HTML 抓取</option>
                <option value="api">API 抓取</option>
              </select>
              <textarea className="studio-input studio-textarea" style={{ minHeight: 96 }} placeholder="可选 parser 配置 JSON" value={sourceParser} onChange={(e) => setSourceParser(e.target.value)} />
              <label className="radar-check"><input type="checkbox" checked={sourceEnabled} onChange={(e) => setSourceEnabled(e.target.checked)} />启用该来源</label>
            </div>
            <div className="radar-form-actions mt-3">
              <button className="studio-btn studio-btn-primary" onClick={saveSource}>{selectedSourceId ? "保存修改" : "创建来源"}</button>
              {selectedSourceId ? (
                <>
                  <button className="studio-btn studio-btn-secondary" onClick={() => fetchNow(selectedSourceId)} disabled={fetching}>抓取该来源</button>
                  <button className="studio-btn studio-btn-secondary" onClick={() => removeSource(selectedSourceId)}>删除</button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {tab === "automation" && (
        <div className="radar-split-grid">
          <section className="studio-panel studio-panel-glass radar-list-panel">
            <div className="radar-list-head">
              <h3 className="studio-title-3">分析配置</h3>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="studio-input"
                placeholder="分析重点（例如：AI 产品机会、商业化、内容方向）"
                value={analysisFocus}
                onChange={(e) => setAnalysisFocus(e.target.value)}
              />
              <input
                className="studio-input"
                placeholder="关键词过滤（可选）"
                value={analysisQ}
                onChange={(e) => setAnalysisQ(e.target.value)}
              />
              <input
                className="studio-input"
                type="number"
                min={5}
                max={80}
                placeholder="分析条数（5-80）"
                value={analysisLimit}
                onChange={(e) => setAnalysisLimit(e.target.value)}
              />
            </div>
            <div className="radar-form-actions mt-3">
              <button className="studio-btn studio-btn-primary" onClick={runAnalysis} disabled={analyzing || loading}>
                {analyzing ? "分析中..." : "开始 AI 分析"}
              </button>
              <button className="studio-btn studio-btn-secondary" onClick={saveAnalysisTopic} disabled={!analysis || saving}>
                保存分析结果
              </button>
            </div>
            <p className="text-sm text-zinc-500 mt-3">分析将基于当前账号已抓取的热点内容执行，不会发送通知。</p>
          </section>

          <section className="studio-panel studio-panel-glass radar-detail-panel">
            <h3 className="studio-title-3">分析结果</h3>
            {!analysis ? (
              <div className="text-sm text-zinc-500 mt-3">暂无结果，点击“开始 AI 分析”生成。</div>
            ) : (
              <div className="radar-ai-result mt-3">
                <p className="radar-ai-summary">{analysis.summary}</p>
                {analysis.keywords.length > 0 ? (
                  <div className="radar-ai-tags">
                    {analysis.keywords.map((keyword) => (
                      <span key={keyword} className="radar-ai-tag">{keyword}</span>
                    ))}
                  </div>
                ) : null}
                <pre className="radar-ai-markdown">{analysis.markdown}</pre>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "library" && (
        <section className="studio-panel studio-panel-glass">
          <h3 className="studio-title-3">选题库</h3>
          <div className="radar-action-row mt-3">
            <input className="studio-input" placeholder="按标题/摘要/正文筛选已保存选题" value={topicQ} onChange={(e) => setTopicQ(e.target.value)} />
            <button className="studio-btn studio-btn-secondary" onClick={searchTopics}>筛选</button>
            <button className="studio-btn studio-btn-secondary" onClick={() => loadTopics("")}>重置</button>
          </div>

          <div className="mt-4 space-y-3">
            {topics.length === 0 && <div className="text-sm text-zinc-500">暂无已保存选题</div>}
            {topics.map((topic) => (
              <article key={topic.id} className="radar-item-card radar-topic-card">
                <div className="radar-topic-head">
                  <h4 className="radar-item-title">{topic.title}</h4>
                  <span className="radar-topic-kind">{topic.kind === "analysis" ? "分析" : "选题"}</span>
                </div>
                {topic.summary ? <p className="radar-item-summary">{topic.summary}</p> : null}
                {topic.content ? <pre className="radar-ai-markdown">{topic.content}</pre> : null}
                <div className="radar-item-meta">
                  <span>{topic.source_name || "未知来源"}</span>
                  <span>热度 {Math.round(topic.score || 0)}</span>
                  <span>{formatDate(topic.created_at)}</span>
                </div>
                <div className="radar-item-actions">
                  {topic.source_url ? (
                    <a href={topic.source_url} target="_blank" rel="noreferrer" className="studio-btn studio-btn-secondary">
                      查看原文
                    </a>
                  ) : null}
                  <button className="studio-btn studio-btn-secondary" onClick={() => removeTopic(topic.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
