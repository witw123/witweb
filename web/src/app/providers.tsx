"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UserProfile = {
  username: string;
  nickname?: string;
  avatar_url?: string;
  following_count?: number;
  follower_count?: number;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const notifyProfileUpdate = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profile-updated"));
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedProfile = localStorage.getItem("profile");
    if (storedToken) {
      setToken(storedToken);
      if (storedProfile) {
        try {
          setUser(JSON.parse(storedProfile));
        } catch {}
      }
    }
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token,
      login: (newToken, profile) => {
        localStorage.setItem("token", newToken);
        localStorage.setItem("profile", JSON.stringify(profile));
        setToken(newToken);
        setUser(profile);
        notifyProfileUpdate();
      },
      logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("profile");
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
