import React, { useState, useEffect } from 'react';
import '../../styles/admin-layout.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/stats/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">加载中...</div>;
  }

  const statCards = [
    { icon: '👥', label: '总用户数', value: stats?.total_users || 0, color: '#3b82f6' },
    { icon: '📝', label: '总文章数', value: stats?.total_blogs || 0, color: '#8b5cf6' },
    { icon: '✅', label: '已发布', value: stats?.total_published_blogs || 0, color: '#10b981' },
    { icon: '📋', label: '草稿', value: stats?.total_draft_blogs || 0, color: '#f59e0b' },
    { icon: '💬', label: '频道数', value: stats?.total_channels || 0, color: '#ec4899' },
    { icon: '💭', label: '消息数', value: stats?.total_messages || 0, color: '#06b6d4' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">仪表盘</h1>
        <p className="page-subtitle">系统概览和统计数据</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ color: card.color }}>
              {card.icon}
            </div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h2 className="card-title">快捷操作</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <a href="/admin/users" className="btn-admin btn-admin-primary">
            👥 管理用户
          </a>
          <a href="/admin/blogs" className="btn-admin btn-admin-primary">
            📝 管理文章
          </a>
          <a href="/admin/ai" className="btn-admin btn-admin-primary">
            🤖 AI服务
          </a>
        </div>
      </div>
    </div>
  );
}
