"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FriendLink {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  sort_order: number;
}

export default function FriendsPage() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/friend-links")
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
                    unoptimized
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
