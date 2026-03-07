"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import { get } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import AdminNotice from "./AdminNotice";

type DashboardStats = {
  total_users?: number;
  total_blogs?: number;
  total_published_blogs?: number;
  total_draft_blogs?: number;
};

type TrendPoint = {
  day: string;
  new_users: number;
  new_posts: number;
  active_users: number;
  messages: number;
};

type TrendData = {
  days: number;
  items: TrendPoint[];
  totals: {
    new_users: number;
    new_posts: number;
    active_users: number;
    messages: number;
  };
};

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (days: 7 | 30) => {
    try {
      setLoading(true);
      const [overviewData, trendsData] = await Promise.all([
        get<DashboardStats>(getVersionedApiPath("/admin/stats/overview")),
        get<TrendData>(`${getVersionedApiPath("/admin/stats/trends")}?days=${days}`),
      ]);

      setStats(overviewData || {});
      setTrends(trendsData || null);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadDashboard(trendDays);
  }, [isAuthenticated, loadDashboard, trendDays]);

  const trendItems = trends?.items || [];
  const maxTrendValue = Math.max(
    1,
    ...trendItems.flatMap((item) => [item.new_users, item.new_posts, item.active_users, item.messages]),
  );
  const chartWidth = 980;
  const chartHeight = 320;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 34;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const getX = (index: number) =>
    trendItems.length <= 1 ? padLeft + innerW / 2 : padLeft + (index / (trendItems.length - 1)) * innerW;
  const getY = (value: number) => padTop + innerH - (value / maxTrendValue) * innerH;

  const buildLine = (key: "new_users" | "new_posts" | "active_users" | "messages") =>
    trendItems
      .map((item, index) => `${getX(index)},${getY(item[key])}`)
      .join(" ");

  const series = [
    { key: "new_users" as const, label: "新增用户", color: "#3b82f6" },
    { key: "new_posts" as const, label: "新增发文", color: "#22c55e" },
    { key: "active_users" as const, label: "活跃用户", color: "#f59e0b" },
    { key: "messages" as const, label: "消息量", color: "#f43f5e" },
  ];

  if (loading) {
    return <div className="admin-dashboard-state">加载中...</div>;
  }

  if (error) {
    return (
      <div className="admin-dashboard-state">
        <AdminNotice message={error} tone="error" />
        <button onClick={() => void loadDashboard(trendDays)} className="admin-dashboard-retry">
          重试
        </button>
      </div>
    );
  }

  const statCards = [
    { label: "总用户数", value: stats?.total_users || 0 },
    { label: "总文章数", value: stats?.total_blogs || 0 },
    { label: "已发布", value: stats?.total_published_blogs || 0 },
    { label: "草稿", value: stats?.total_draft_blogs || 0 },
  ];

  const trendCards = [
    { key: "new_users", label: `新增用户（${trendDays}天）`, value: trends?.totals.new_users || 0 },
    { key: "new_posts", label: `新增发文（${trendDays}天）`, value: trends?.totals.new_posts || 0 },
    { key: "active_users", label: `活跃用户累计（${trendDays}天）`, value: trends?.totals.active_users || 0 },
    { key: "messages", label: `消息量（${trendDays}天）`, value: trends?.totals.messages || 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">仪表盘</h1>
        <p className="page-subtitle">系统概览与统计数据</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card">
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{Number(card.value).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="card-header admin-card-header-wrap">
          <h2 className="card-title">趋势看板</h2>
          <div className="admin-dashboard-toggle-group">
            <button
              type="button"
              className={`btn-admin ${trendDays === 7 ? "btn-admin-primary" : "btn-admin-secondary"}`}
              onClick={() => setTrendDays(7)}
            >
              近 7 天
            </button>
            <button
              type="button"
              className={`btn-admin ${trendDays === 30 ? "btn-admin-primary" : "btn-admin-secondary"}`}
              onClick={() => setTrendDays(30)}
            >
              近 30 天
            </button>
          </div>
        </div>

        <div className="stats-grid admin-dashboard-trend-grid">
          {trendCards.map((card) => (
            <div key={card.key} className="stat-card">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{Number(card.value).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="line-chart-wrapper">
          <div className="line-chart-legend">
            {series.map((item) => (
              <span key={item.key} className="line-legend-item">
                <i className="admin-dashboard-legend-dot" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <svg
            className="line-chart-svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="趋势折线图"
          >
            {[0, 1, 2, 3, 4].map((tick) => {
              const value = Math.round((maxTrendValue * (4 - tick)) / 4);
              const y = padTop + (tick / 4) * innerH;
              return (
                <g key={tick}>
                  <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} className="line-grid" />
                  <text x={padLeft - 8} y={y + 4} textAnchor="end" className="line-axis-label">
                    {value}
                  </text>
                </g>
              );
            })}

            {series.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={buildLine(s.key)}
              />
            ))}

            {series.map((s) =>
              trendItems.map((item, index) => (
                <circle key={`${s.key}-${item.day}`} cx={getX(index)} cy={getY(item[s.key])} r="2.6" fill={s.color} />
              )),
            )}
          </svg>
          <div className="line-x-axis">
            {trendItems.map((item) => (
              <span key={item.day}>{item.day.slice(5)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h2 className="card-title">快捷操作</h2>
        </div>
        <div className="admin-dashboard-action-grid">
          <a href="/admin/users" className="btn-admin btn-admin-primary">
            管理用户
          </a>
          <a href="/admin/blogs" className="btn-admin btn-admin-primary">
            管理文章
          </a>
        </div>
      </div>
    </div>
  );
}
