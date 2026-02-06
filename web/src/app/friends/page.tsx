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
      <div className="container py-8">
        <div className="text-center text-muted">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">友情链接</h1>
        <p className="text-muted">这里收录了一些优秀的博客和网站</p>
      </div>

      {links.length === 0 ? (
        <div className="py-12 text-center text-muted">暂无友情链接</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card transition-all duration-200 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex items-start gap-4">
                {link.avatar_url || getFallbackIcon(link.url) ? (
                  <Image
                    src={link.avatar_url || getFallbackIcon(link.url)}
                    alt={link.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
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
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xl font-bold text-white">
                    {link.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 truncate text-lg font-semibold">{link.name}</h3>
                  {link.description && <p className="line-clamp-2 text-sm text-muted">{link.description}</p>}
                  <p className="mt-2 truncate text-xs text-blue-400">{link.url}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
