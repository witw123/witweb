"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/stats/overview", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.error?.message || "获取数据失败");
        return;
      }

      setStats(data.data || {});
      setError("");
    } catch (err: any) {
      setError(err.message || "请求失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", color: "#666" }}>加载中...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "#ef4444" }}>
        <p>错误: {error}</p>
        <button onClick={() => void loadStats()} style={{ marginTop: "1rem" }}>
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
        <div className="card-header">
          <h2 className="card-title">快捷操作</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
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
