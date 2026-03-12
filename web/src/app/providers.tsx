/**
 * 应用 Providers 组件
 *
 * 集中定义运行在客户端的全局上下文。
 * 当前文件主要负责认证态的恢复、广播与消费，避免每个页面都单独请求
 * “当前用户”接口并重复维护登录状态。
 */

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getVersionedApiPath } from "@/lib/api-version";

/**
 * UserProfile - 用户资料数据类型
 *
 * 描述前端认证上下文中缓存的当前用户资料。
 * 字段并不要求一次性全部存在，路由会根据不同页面按需返回子集。
 */
export type UserProfile = {
  username: string;
  role?: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot";
  nickname?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  created_at?: string;
  following_count?: number;
  follower_count?: number;
  post_count?: number;
  activity_count?: number;
  balance?: number;
};

/**
 * AuthContextValue - 认证上下文值类型
 *
 * 统一约定登录态读取和更新接口，避免页面直接操作底层状态。
 */
type AuthContextValue = {
  /** 当前登录用户资料，未登录时为 null */
  user: UserProfile | null;
  /** 登录方法，接收用户资料并更新状态 */
  login: (profile: UserProfile) => void;
  /** 登出方法，清除用户状态并调用后端登出接口 */
  logout: () => void;
  /** 更新用户资料方法 */
  updateProfile: (profile: UserProfile) => void;
  /** 认证状态加载中标志 */
  loading: boolean;
  /** 是否已认证（用户是否已登录） */
  isAuthenticated: boolean;
};

/**
 * AuthContext - 认证上下文
 *
 * 所有需要用户状态的组件都应通过 `useAuth` 消费该上下文，
 * 这样后续如果认证来源从 Cookie 扩展到其他机制，调用侧无需重写。
 */
const AuthContext = createContext<AuthContextValue | null>(null);

type ProfileResponse = {
  profile?: UserProfile;
};

/**
 * 使用 Cookie 凭证请求用户资料
 *
 * 通过带 Cookie 的同源请求恢复当前登录用户。
 * 这里把失败统一折叠成 `null`，让上层只关心“是否已登录”，而不需要
 * 区分网络失败、401 或响应结构异常。
 *
 * @returns {Promise<UserProfile | null>} 用户资料，未登录或请求失败返回 null
 */
async function requestProfileWithCookie(): Promise<UserProfile | null> {
  const response = await fetch(getVersionedApiPath("/profile"), {
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: ProfileResponse;
  };

  if (!response.ok || !payload.success || !payload.data?.profile) {
    return null;
  }

  return payload.data.profile;
}

/**
 * AuthProvider - 认证状态 Provider 组件
 *
 * 负责在客户端启动后恢复登录状态，并向整个组件树提供用户信息。
 * 同时通过浏览器事件广播资料变更，兼容站内多个独立订阅点同步刷新。
 *
 * @param children - 子组件
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const profile = await requestProfileWithCookie();
        if (!cancelled) {
          if (profile) {
            setUser(profile);
            setLoading(false);
            return;
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // 首次挂载时只恢复一次认证态，避免路由切换重复打“当前用户”请求。
    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const notifyProfileUpdate = () => {
    if (typeof window !== "undefined") {
      // 站内其他订阅点可通过该事件做轻量刷新，而不必共享更重的状态管理器。
      window.dispatchEvent(new Event("profile-updated"));
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login: (profile) => {
        setUser(profile);
        notifyProfileUpdate();
      },
      logout: () => {
        setUser(null);
        // 登出请求采用“尽力而为”策略，确保前端状态优先退出，避免 UI 卡在半登录态。
        void fetch("/api/v1/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        }).catch(() => {});
        notifyProfileUpdate();
      },
      updateProfile: (profile) => {
        setUser(profile);
        notifyProfileUpdate();
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth - 认证状态 Hook
 *
 * 在组件内读取全局认证状态。
 * 直接在 Provider 外使用通常意味着组件被错误放置在客户端边界之外，因此显式抛错。
 *
 * @returns {AuthContextValue} 认证上下文值，包含用户信息、登录/登出方法等
 * @throws {Error} 如果在 AuthProvider 外部使用，抛出错误
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
