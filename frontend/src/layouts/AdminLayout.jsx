import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/admin-layout.css';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 权限检查
  if (!user || user.username !== 'witw') {
    navigate('/');
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: '📊', label: '仪表盘' },
    { path: '/admin/users', icon: '👥', label: '用户管理' },
    { path: '/admin/blogs', icon: '📝', label: '文章管理' },
    { path: '/admin/ai', icon: '🤖', label: 'AI服务' },
  ];

  return (
    <div className="admin-layout">
      {/* 侧边栏 */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>管理后台</h2>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user.username}</span>
            <span className="user-role">管理员</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
