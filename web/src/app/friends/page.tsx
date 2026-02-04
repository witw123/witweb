"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
        setLinks(data.links || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch friend links:", error);
        setLoading(false);
      });
  }, []);

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
        <h1 className="text-3xl font-bold mb-2">友情链接</h1>
        <p className="text-muted">这里收录了一些优秀的博客和网站</p>
      </div>

      {links.length === 0 ? (
        <div className="text-center text-muted py-12">
          暂无友情链接
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:border-blue-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="flex items-start gap-4">
                {link.avatar_url ? (
                  <img
                    src={link.avatar_url}
                    alt={link.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {link.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1 truncate">
                    {link.name}
                  </h3>
                  {link.description && (
                    <p className="text-sm text-muted line-clamp-2">
                      {link.description}
                    </p>
                  )}
                  <p className="text-xs text-blue-400 mt-2 truncate">
                    {link.url}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
