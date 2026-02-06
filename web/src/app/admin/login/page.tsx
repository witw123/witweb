"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";

export default function AdminLoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    void fetch("/api/admin/stats/overview", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (res.ok) {
        router.replace("/admin");
      }
    });
  }, [loading, isAuthenticated, router]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码");
      return;
    }

    setLoadingSubmit(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError(data.error?.message || "登录失败，请稍后重试");
        return;
      }

      const verifyRes = await fetch("/api/admin/stats/overview", {
        headers: {
          Authorization: `Bearer ${data.data.token}`,
        },
      });
      if (!verifyRes.ok) {
        setError("仅管理员账号可登录管理后台");
        return;
      }

      login(data.data.token, data.data.profile);
      router.replace("/admin");
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">管理后台</h1>
        <p className="text-secondary">管理员登录</p>
      </div>

      <form className="card form w-full max-w-md p-8 shadow-lg" onSubmit={handleLogin}>
        <label className="block mb-4">
          <span className="block mb-1 font-medium">账号</span>
          <input
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入管理员账号"
          />
        </label>
        <label className="block mb-6">
          <span className="block mb-1 font-medium">密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
          />
        </label>
        {error && (
          <p className="text-accent mb-4 text-sm bg-accent/10 p-3 rounded border border-accent/20">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button className="btn-primary w-full justify-center" type="submit" disabled={loadingSubmit}>
            {loadingSubmit ? "登录中..." : "登录"}
          </button>
        </div>
      </form>
    </div>
  );
}
