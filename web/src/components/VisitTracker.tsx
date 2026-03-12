"use client";

/**
 * VisitTracker 访问追踪组件
 *
 * 用于追踪已登录用户的访问记录。
 * 为每个用户生成唯一的访客 ID 并记录访问的页面路径。
 * 该组件不渲染任何可见内容（null return）。
 *
 * @component
 * @example
 * <VisitTracker />
 */

import { useEffect } from "react";
import { useAuth } from "@/app/providers";
import { getVersionedApiPath } from "@/lib/api-version";

/**
 * 生成唯一的访客 ID 并存储在 localStorage 中
 * @returns 访客 ID 字符串
 */
function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  let visitorId = localStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
}

/**
 * VisitTracker 组件 - 追踪用户访问记录
 */
export default function VisitTracker() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const trackVisit = async () => {
      try {
        const visitorId = getVisitorId();
        const pageUrl = window.location.pathname;

        await fetch(getVersionedApiPath("/track-visit"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ visitorId, pageUrl }),
        });
      } catch (error) {
        console.error("Failed to track visit:", error);
      }
    };

    // Track visit on mount
    trackVisit();
  }, [isAuthenticated]);

  return null; // This component doesn't render anything
}
