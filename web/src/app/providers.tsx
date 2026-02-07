"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";

export type UserProfile = {
  username: string;
  role?: "admin" | "user" | "bot";
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

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  login: (token: string, profile: UserProfile) => void;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
  loading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function syncAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;

  if (!token) {
    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  const encoded = encodeURIComponent(token);
  document.cookie = `${AUTH_COOKIE_NAME}=${encoded}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedProfile = localStorage.getItem("profile");

    if (!storedToken || !storedProfile) {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("profile");
      syncAuthCookie(null);
      setLoading(false);
      return;
    }

    try {
      setToken(storedToken);
      setUser(JSON.parse(storedProfile) as UserProfile);
      syncAuthCookie(storedToken);
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
      localStorage.removeItem("profile");
      syncAuthCookie(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const notifyProfileUpdate = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profile-updated"));
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      login: (newToken, profile) => {
        localStorage.setItem("token", newToken);
        localStorage.setItem("profile", JSON.stringify(profile));
        syncAuthCookie(newToken);
        setToken(newToken);
        setUser(profile);
        notifyProfileUpdate();
      },
      logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("profile");
        syncAuthCookie(null);
        setToken(null);
        setUser(null);
        notifyProfileUpdate();
      },
      updateProfile: (profile) => {
        localStorage.setItem("profile", JSON.stringify(profile));
        setUser(profile);
        notifyProfileUpdate();
      },
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
