import React, { useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getThumbnailUrl } from '../utils/url';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isStudio = location.pathname.startsWith('/studio');

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowUserMenu(false);
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <Link to="/" className="brand">
            witweb
          </Link>

          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              讨论区
            </NavLink>
            <NavLink to="/studio" className={({ isActive }) => isActive || isStudio ? 'nav-link active' : 'nav-link'} target="_blank" rel="noopener noreferrer">
              视频生成
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                发布文章
              </NavLink>
            )}
          </nav>

          <div className="actions">
            {isAuthenticated ? (
              <div className="user-menu-container">
                <button
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user?.avatar_url ? (
                    <img
                      src={getThumbnailUrl(user.avatar_url, 64)}
                      alt={user.nickname || user.username}
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-avatar-fallback">
                      {(user?.nickname || user?.username)?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="user-name">{user?.nickname || user?.username}</span>
                  <svg className="dropdown-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 8L2 4h8L6 8z" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    <Link
                      to="/profile"
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      个人中心
                    </Link>
                    <Link
                      to="/favorites"
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      我的收藏
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="dropdown-item"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn-ghost">登录</Link>
                <Link to="/register" className="btn-primary">注册</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`main-content ${isStudio ? 'full-width' : 'container'}`}>
        {children}
      </main>

      {!isStudio && (
        <footer className="footer">
          <div className="container">
            <p>© {new Date().getFullYear()} witweb. 基于 React & FastAPI 构建</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
