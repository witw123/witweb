"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getVersionedApiPath } from "@/lib/api-version";

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

type AuthContextValue = {
  user: UserProfile | null;
  login: (profile: UserProfile) => void;
  logout: () => void;
  updateProfile: (profile: UserProfile) => void;
  loading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type ProfileResponse = {
  profile?: UserProfile;
};

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

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const notifyProfileUpdate = () => {
    if (typeof window !== "undefined") {
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
