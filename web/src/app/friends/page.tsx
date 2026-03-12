/**
 * 友链页面路由
 *
 * 显示本站收录的友情链街列表
 * 从后端 API 获取友链数据并渲染，支持站点头像和描述展示
 */

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getVersionedApiPath } from "@/lib/api-version";
import { shouldBypassImageOptimization } from "@/utils/url";

/**
 * FriendLink - 友链数据结构
 *
 * 定义友情链街的数据模型
 */
interface FriendLink {
  /** 友链 ID */
  id: number;
  /** 站点名称 */
  name: string;
  /** 站点 URL */
  url: string;
  /** 站点描述 */
  description: string | null;
  /** 站点头像 URL */
  avatar_url: string | null;
  /** 排序权重 */
  sort_order: number;
}

/**
 * FriendsPage - 友链页面组件
 *
 * 渲染友情链街列表，包含以下功能：
 * - 从后端 API 获取友链数据
 * - 展示站点头像、名称、描述和 URL
 * - 头像加载失败时使用 fallback 图标或站点 favicon
 * - 加载状态显示
 */
export default function FriendsPage() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getVersionedApiPath("/friend-links"))
      .then((res) => res.json())
      .then((data) => {
        setLinks(data.data?.links || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch friend links:", error);
        setLoading(false);
      });
  }, []);

  /**
   * 获取站点 fallback 图标
   *
   * 当友链没有自定义头像时，使用站点的 favicon.ico 作为备用
   *
   * @param {string} siteUrl - 站点 URL
   * @returns {string} favicon.ico 的完整 URL，解析失败时返回空字符串
   */
  const getFallbackIcon = (siteUrl: string) => {
    try {
      return `${new URL(siteUrl).origin}/favicon.ico`;
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="app-page-shell friends-page">
        <div className="app-page-container">
          <div className="app-loading-fallback">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page-shell friends-page">
      <div className="app-page-container">
      <div className="app-page-header">
        <h1 className="app-page-title">友情链接</h1>
        <p className="app-page-subtitle">这里收录了一些优秀的博客和网站</p>
      </div>

      {links.length === 0 ? (
        <div className="py-12 text-center text-muted">暂无友情链接</div>
      ) : (
        <div className="friend-links-list">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="friend-link-card"
            >
              <div className="friend-link-content">
                {link.avatar_url || getFallbackIcon(link.url) ? (
                  <Image
                    src={link.avatar_url || getFallbackIcon(link.url)}
                    alt={link.name}
                    width={74}
                    height={74}
                    className="friend-link-avatar"
                    unoptimized={shouldBypassImageOptimization(link.avatar_url || getFallbackIcon(link.url))}
                    onError={(e) => {
                      const fallback = getFallbackIcon(link.url);
                      if (fallback && (e.currentTarget as HTMLImageElement).src !== fallback) {
                        (e.currentTarget as HTMLImageElement).src = fallback;
                        return;
                      }
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="friend-link-avatar friend-link-avatar-fallback">
                    {link.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="friend-link-text">
                  <h3 className="friend-link-name">{link.name}</h3>
                  {link.description && <p className="friend-link-desc">{link.description}</p>}
                  <p className="friend-link-url">{link.url}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
