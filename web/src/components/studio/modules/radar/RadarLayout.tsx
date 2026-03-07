"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/app/providers";
import type { RadarSource } from "./hooks/useRadarSources";
import { useRadarSources } from "./hooks/useRadarSources";
import { useRadarItems, type RadarItem } from "./hooks/useRadarItems";
import { useRadarTopics } from "./hooks/useRadarTopics";

type RadarTab = "discover" | "sources" | "automation" | "library";
type SourceFormMode = "existing" | "new";
type SourceFormState = {
  name: string;
  url: string;
  type: "rss" | "html" | "api";
  parser: string;
  enabled: boolean;
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
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<RadarTab>("discover");
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [topicQ, setTopicQ] = useState("");
  const [appliedTopicQ, setAppliedTopicQ] = useState("");
  const [analysisQ, setAnalysisQ] = useState("");
  const [analysisFocus, setAnalysisFocus] = useState("");
  const [analysisLimit, setAnalysisLimit] = useState("30");

  const [sourceFormMode, setSourceFormMode] = useState<SourceFormMode>("existing");
  const [selectedSourceIdState, setSelectedSourceId] = useState<number | null>(null);
  const [sourceForm, setSourceForm] = useState<SourceFormState>({
    name: "",
    url: "",
    type: "rss",
    parser: "",
    enabled: true,
  });

  const {
    sources,
    loadingSources,
    refreshSources,
    saveSource,
    savingSource,
    deleteSource,
    deletingSource,
    fetchNow,
    fetchingNow,
  } = useRadarSources(isAuthenticated);

  const {
    items,
    loadingItems,
    refreshItems,
    clearItems,
    clearingItems,
    analyze,
    analyzing,
    analysisResult,
  } = useRadarItems(isAuthenticated, { q: appliedQ, limit: 120 });

  const {
    topics,
    loadingTopics,
    refreshTopics,
    saveTopic,
    savingTopic,
    deleteTopic,
    deletingTopic,
  } = useRadarTopics(isAuthenticated, { q: appliedTopicQ, limit: 120 });

  const sourceList = useMemo(
    () => [...sources].sort((a, b) => b.enabled - a.enabled),
    [sources]
  );

  const toSourceForm = (source?: RadarSource | null): SourceFormState => ({
    name: source?.name || "",
    url: source?.url || "",
    type: source?.type || "rss",
    parser: source?.parser_config_json || "",
    enabled: source ? source.enabled === 1 : true,
  });

  const selectedSourceId = useMemo(() => {
    if (sourceFormMode === "new" || sourceList.length === 0) return null;
    if (
      selectedSourceIdState != null &&
      sourceList.some((item) => item.id === selectedSourceIdState)
    ) {
      return selectedSourceIdState;
    }
    return sourceList[0].id;
  }, [selectedSourceIdState, sourceFormMode, sourceList]);

  const selectedSource = useMemo(
    () => sourceList.find((item) => item.id === selectedSourceId) || null,
    [sourceList, selectedSourceId]
  );
  const activeSourceForm = useMemo(() => {
    if (sourceFormMode === "new") return sourceForm;
    if (
      selectedSourceIdState == null &&
      selectedSource &&
      sourceForm.name === "" &&
      sourceForm.url === ""
    ) {
      return toSourceForm(selectedSource);
    }
    return sourceForm;
  }, [selectedSource, selectedSourceIdState, sourceForm, sourceFormMode]);

  const sourceName = activeSourceForm.name;
  const sourceUrl = activeSourceForm.url;
  const sourceType = activeSourceForm.type;
  const sourceParser = activeSourceForm.parser;
  const sourceEnabled = activeSourceForm.enabled;
  const setSourceName = (value: string) =>
    setSourceForm((prev) => ({ ...prev, name: value }));
  const setSourceUrl = (value: string) =>
    setSourceForm((prev) => ({ ...prev, url: value }));
  const setSourceType = (value: "rss" | "html" | "api") =>
    setSourceForm((prev) => ({ ...prev, type: value }));
  const setSourceParser = (value: string) =>
    setSourceForm((prev) => ({ ...prev, parser: value }));
  const setSourceEnabled = (value: boolean) =>
    setSourceForm((prev) => ({ ...prev, enabled: value }));

  const resetSourceForm = () => {
    setSourceFormMode("new");
    setSelectedSourceId(null);
    setSourceForm(toSourceForm(null));
  };

  const selectSource = (source: RadarSource) => {
    setSourceFormMode("existing");
    setSelectedSourceId(source.id);
    setSourceForm(toSourceForm(source));
  };

  async function initialize() {
    setError("");
    try {
      await Promise.all([refreshSources(), refreshItems(), refreshTopics()]);
    } catch {
      setError("加载失败，请稍后重试");
    }
  }

  async function handleSaveSource() {
    if (!activeSourceForm.name.trim() || !activeSourceForm.url.trim()) return;
    setError("");

    if (activeSourceForm.parser.trim()) {
      try {
        JSON.parse(activeSourceForm.parser);
      } catch {
        setError("Parser 配置必须是合法 JSON");
        return;
      }
    }

    try {
      await saveSource({
        sourceId: sourceFormMode === "existing" ? selectedSourceId : null,
        payload: {
          name: activeSourceForm.name.trim(),
          url: activeSourceForm.url.trim(),
          type: activeSourceForm.type,
          parser_config_json: activeSourceForm.parser.trim() || "{}",
          enabled: activeSourceForm.enabled,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存来源失败");
    }
  }

  async function handleRemoveSource(sourceId: number) {
    setError("");
    try {
      await deleteSource(sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除来源失败");
    }
  }

  async function handleFetchNow(sourceId?: number) {
    setError("");
    try {
      await fetchNow(sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "抓取失败，请检查来源可达性");
    }
  }

  async function handleClearItems() {
    const ok = window.confirm("确认清空热点列表吗？此操作会删除当前账号的雷达抓取结果。");
    if (!ok) return;
    setError("");
    try {
      await clearItems(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空失败，请稍后重试");
    }
  }

  async function saveTopicFromItem(item: RadarItem) {
    setError("");
    try {
      await saveTopic({
        kind: "item",
        title: item.title,
        summary: item.summary,
        source_name: item.source_name,
        source_url: item.url,
        score: item.score,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存选题失败");
    }
  }

  async function runAnalysis() {
    setError("");
    try {
      const limit = Number(analysisLimit || "30");
      await analyze({
        limit: Number.isFinite(limit) ? limit : 30,
        q: analysisQ.trim() || undefined,
        focus: analysisFocus.trim() || undefined,
        sourceId: selectedSourceId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分析失败");
    }
  }

  async function saveAnalysisTopic() {
    if (!analysisResult) return;
    setError("");
    try {
      await saveTopic({
        kind: "analysis",
        title: `AI 分析结论 ${new Date().toLocaleDateString("zh-CN")}`,
        summary: analysisResult.summary,
        content: analysisResult.markdown,
        source_name: selectedSource?.name || "全部来源",
        source_url: "",
        score: 0,
        tags: analysisResult.keywords,
      });
      setTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存分析失败");
    }
  }

  async function handleRemoveTopic(topicId: number) {
    const ok = window.confirm("确认删除这个已保存选题吗？");
    if (!ok) return;
    setError("");
    try {
      await deleteTopic(topicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除选题失败");
    }
  }

  const stats = useMemo(() => {
    const enabledSources = sources.filter((item) => item.enabled === 1).length;
    return {
      sources: sources.length,
      enabledSources,
      items: items.length,
      analyzed: analysisResult ? 1 : 0,
      selectedSource: selectedSourceId ? 1 : 0,
      topics: topics.length,
    };
  }, [sources, items, analysisResult, selectedSourceId, topics]);

  const loading = authLoading || loadingSources || loadingItems || loadingTopics;

  if (!isAuthenticated && !authLoading) {
    return <div className="studio-empty">请先登录后使用。</div>;
  }

  return (
    <section className="radar-shell radar-shell-v2">
      <div className="studio-section-head radar-head-v2">
        <div>
          <h2 className="agent-title">选题雷达</h2>
          <p className="agent-subtitle">
            抓取热点，筛选选题，并用 AI 直接产出分析结论。
          </p>
        </div>
        <div className="radar-head-actions">
          <button className="studio-btn studio-btn-secondary" onClick={() => void initialize()} disabled={loading}>
            刷新
          </button>
          <button
            className="studio-btn studio-btn-primary"
            onClick={() => void handleFetchNow()}
            disabled={fetchingNow || loading}
          >
            {fetchingNow ? "抓取中..." : "抓取全部来源"}
          </button>
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
            <input className="studio-input" placeholder="按关键词筛选标题或摘要" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="studio-btn studio-btn-secondary" onClick={() => setAppliedQ(q)}>筛选</button>
            <button className="studio-btn studio-btn-secondary" onClick={() => void handleClearItems()} disabled={clearingItems}>清空热点</button>
          </div>

          <div className="mt-4 space-y-3">
            {items.length === 0 && !loadingItems && <div className="text-sm text-zinc-500">暂无热点，先抓取来源</div>}
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
                  <button className="studio-btn studio-btn-secondary" onClick={() => void saveTopicFromItem(item)} disabled={savingTopic}>
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
              {sourceList.length === 0 && !loadingSources && <div className="text-sm text-zinc-500">暂无来源</div>}
              {sourceList.map((source) => (
                <button key={source.id} className={`radar-list-item ${selectedSourceId === source.id ? "is-active" : ""}`} onClick={() => selectSource(source)}>
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
              <button className="studio-btn studio-btn-primary" onClick={() => void handleSaveSource()} disabled={savingSource}>{selectedSourceId ? "保存修改" : "创建来源"}</button>
              {selectedSourceId ? (
                <>
                  <button className="studio-btn studio-btn-secondary" onClick={() => void handleFetchNow(selectedSourceId)} disabled={fetchingNow}>抓取该来源</button>
                  <button className="studio-btn studio-btn-secondary" onClick={() => void handleRemoveSource(selectedSourceId)} disabled={deletingSource}>删除</button>
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
                placeholder="分析重点，例如 AI 产品机会、商业化、内容方向"
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
              <button className="studio-btn studio-btn-primary" onClick={() => void runAnalysis()} disabled={analyzing || loading}>
                {analyzing ? "分析中..." : "开始 AI 分析"}
              </button>
              <button className="studio-btn studio-btn-secondary" onClick={() => void saveAnalysisTopic()} disabled={!analysisResult || savingTopic}>
                保存分析结果
              </button>
            </div>
            <p className="text-sm text-zinc-500 mt-3">分析将基于当前账号已抓取的热点内容执行，不会发送通知。</p>
          </section>

          <section className="studio-panel studio-panel-glass radar-detail-panel">
            <h3 className="studio-title-3">分析结果</h3>
            {!analysisResult ? (
              <div className="text-sm text-zinc-500 mt-3">暂无结果，点击“开始 AI 分析”生成。</div>
            ) : (
              <div className="radar-ai-result mt-3">
                <p className="radar-ai-summary">{analysisResult.summary}</p>
                {analysisResult.keywords.length > 0 ? (
                  <div className="radar-ai-tags">
                    {analysisResult.keywords.map((keyword) => (
                      <span key={keyword} className="radar-ai-tag">{keyword}</span>
                    ))}
                  </div>
                ) : null}
                <pre className="radar-ai-markdown">{analysisResult.markdown}</pre>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "library" && (
        <section className="studio-panel studio-panel-glass">
          <h3 className="studio-title-3">选题库</h3>
          <div className="radar-action-row mt-3">
            <input className="studio-input" placeholder="按标题、摘要或正文筛选已保存选题" value={topicQ} onChange={(e) => setTopicQ(e.target.value)} />
            <button className="studio-btn studio-btn-secondary" onClick={() => setAppliedTopicQ(topicQ)}>筛选</button>
            <button className="studio-btn studio-btn-secondary" onClick={() => setAppliedTopicQ("")}>重置</button>
          </div>

          <div className="mt-4 space-y-3">
            {topics.length === 0 && !loadingTopics && <div className="text-sm text-zinc-500">暂无已保存选题</div>}
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
                  <button className="studio-btn studio-btn-secondary" onClick={() => void handleRemoveTopic(topic.id)} disabled={deletingTopic}>
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
