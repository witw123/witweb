"use client";

import Image from "next/image";
import { ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { getVersionedApiPath } from "@/lib/api-version";
import { getThumbnailUrl, shouldBypassImageOptimization } from "@/utils/url";
import type { SuccessResponse } from "@/lib/api-response";
import type { UserProfile } from "@/types/user";

interface UserHoverCardProps {
  username: string;
  children: ReactNode;
  className?: string;
  disableHover?: boolean;
}

type HoverUserProfile = UserProfile & {
  like_received_count?: number;
  is_following?: boolean;
};

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

export default function UserHoverCard({ username, children, className = "", disableHover = false }: UserHoverCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [profile, setProfile] = useState<HoverUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, user: authUser } = useAuth();
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  async function fetchProfile() {
    if (profile || loading) return;
    setLoading(true);
    try {
      const res = await fetch(getVersionedApiPath(`/users/${encodeURIComponent(username)}/profile`));
      const payload = await res.json().catch(() => ({}));
      setProfile(readSuccessData<HoverUserProfile>(payload));
    } finally {
      setLoading(false);
    }
  }

  const handleMouseEnter = () => {
    if (disableHover) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsVisible(true);
      void fetchProfile();
    }, 350);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    leaveTimer.current = setTimeout(() => setIsVisible(false), 300);
  };

  const toggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !profile) return;
    if (profile.is_following) {
      await fetch(getVersionedApiPath(`/follow/${username}`), { method: "DELETE" });
    } else {
      await fetch(getVersionedApiPath("/follow"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    }
    const res = await fetch(getVersionedApiPath(`/users/${encodeURIComponent(username)}/profile`));
    const payload = await res.json().catch(() => ({}));
    setProfile(readSuccessData<HoverUserProfile>(payload));
  };

  const isOwnProfile = authUser?.username === username;

  return (
    <div className={`relative inline-block ${className}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Link href={`/user/${username || ""}`} className="block h-full w-full">{children}</Link>

      {isVisible && (
        <div className="user-hover-card-popover" onMouseEnter={() => leaveTimer.current && clearTimeout(leaveTimer.current)} onMouseLeave={handleMouseLeave}>
          {loading && !profile ? (
            <div className="flex items-center justify-center p-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : profile ? (
            <>
              <div className="hover-card-cover" style={profile.cover_url ? { backgroundImage: `url(${getThumbnailUrl(profile.cover_url, 400)})` } : {}} />
              <div className="hover-card-content">
                <div className="hover-card-info-row">
                  <Link href={`/user/${username || ""}`} className="hover-card-avatar">
                    {profile.avatar_url ? (
                      <Image
                        src={getThumbnailUrl(profile.avatar_url, 128)}
                        alt={profile.nickname || username}
                        width={64}
                        height={64}
                        unoptimized={shouldBypassImageOptimization(getThumbnailUrl(profile.avatar_url, 128))}
                      />
                    ) : (
                      <div className="avatar-fallback-rect">{(username?.[0] || "?").toUpperCase()}</div>
                    )}
                  </Link>

                  <div className="hover-card-info-right">
                    <div className="hover-card-identity">
                      <Link href={`/user/${username || ""}`} className="hover-card-name" title={profile.nickname || username}>
                        {profile.nickname || username}
                      </Link>
                    </div>
                    <div className="hover-card-stats">
                      <Link href={`/following?username=${username || ""}`} className="hover-card-stat">
                        <span className="stat-value">{profile.following_count}</span>
                        <span className="stat-label">关注</span>
                      </Link>
                      <Link href={`/followers?username=${username || ""}`} className="hover-card-stat">
                        <span className="stat-value">{profile.follower_count}</span>
                        <span className="stat-label">粉丝</span>
                      </Link>
                      <div className="hover-card-stat">
                        <span className="stat-value">{profile.like_received_count || 0}</span>
                        <span className="stat-label">获赞</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hover-card-bio" title={profile.bio ?? undefined}>
                  {profile.bio || "这个人很懒，什么都没有写"}
                </div>

                <div className="hover-card-actions">
                  {isOwnProfile ? (
                    <Link href="/profile" className="action-btn edit-btn">编辑资料</Link>
                  ) : (
                    <>
                      <button onClick={toggleFollow} className={`action-btn follow-btn ${profile.is_following ? "following" : ""}`}>
                        {profile.is_following ? "已关注" : "关注"}
                      </button>
                      <Link href={`/messages?username=${username}`} className="action-btn message-btn">
                        发消息
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
