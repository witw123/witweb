"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { getThumbnailUrl } from "@/utils/url";

interface UserHoverCardProps {
  username: string;
  children: ReactNode;
  className?: string;
  disableHover?: boolean;
}

export default function UserHoverCard({ username, children, className = "", disableHover = false }: UserHoverCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { token, user: authUser } = useAuth();
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchProfile = async () => {
    if (profile || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (disableHover) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);

    hoverTimer.current = setTimeout(() => {
      setIsVisible(true);
      fetchProfile();
    }, 350); // Delay before showing
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    leaveTimer.current = setTimeout(() => {
      setIsVisible(false);
    }, 300); // Delay before hiding
  };

  const toggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || !profile) return;

    const isFollowing = profile.is_following;
    try {
      if (isFollowing) {
        await fetch(`/api/follow/${username}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } else {
        await fetch(`/api/follow`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ username }) });
      }
      // Re-fetch profile to update status
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
    }
  };

  const isOwnProfile = authUser?.username === username;

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={`/user/${username}`} className="block h-full w-full">
        {children}
      </Link>

      {isVisible && (
        <div
          ref={cardRef}
          className="user-hover-card-popover"
          onMouseEnter={() => {
            if (leaveTimer.current) clearTimeout(leaveTimer.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {loading && !profile ? (
            <div className="p-10 flex justify-center items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : profile ? (
            <>
              {/* Cover */}
              <div
                className="hover-card-cover"
                style={profile.cover_url ? { backgroundImage: `url(${getThumbnailUrl(profile.cover_url, 400)})` } : {}}
              />

              <div className="hover-card-content">
                <div className="hover-card-info-row">
                  <Link href={`/user/${username}`} className="hover-card-avatar">
                    {profile.avatar_url ? (
                      <img src={getThumbnailUrl(profile.avatar_url, 128)} alt="" />
                    ) : (
                      <div className="avatar-fallback-rect">{username[0].toUpperCase()}</div>
                    )}
                  </Link>

                  <div className="hover-card-info-right">
                    <div className="hover-card-identity">
                      <Link href={`/user/${username}`} className="hover-card-name" title={profile.nickname || username}>
                        {profile.nickname || username}
                      </Link>
                    </div>

                    <div className="hover-card-stats">
                      <Link href={`/following?username=${username}`} className="hover-card-stat">
                        <span className="stat-value">{profile.following_count}</span>
                        <span className="stat-label">关注</span>
                      </Link>
                      <Link href={`/followers?username=${username}`} className="hover-card-stat">
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

                <div className="hover-card-bio" title={profile.bio}>
                  {profile.bio || "这个人很懒，什么都没有写~"}
                </div>

                <div className="hover-card-actions">
                  {isOwnProfile ? (
                    <Link href="/profile" className="action-btn edit-btn">
                      编辑资料
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={toggleFollow}
                        className={`action-btn follow-btn ${profile.is_following ? "following" : ""}`}
                      >
                        {profile.is_following ? (
                          "已关注"
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            关注
                          </>
                        )}
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
