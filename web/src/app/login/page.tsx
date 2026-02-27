"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import TurnstileWidget from "@/components/TurnstileWidget";


export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileEnabled =
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true" && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码");
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      setError("请先完成验证码验证");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error?.message || "登录失败，请稍后重试");
        return;
      }
      if (data.data?.token && data.data?.profile) {
        login(data.data.token, data.data.profile);
      }
      router.push("/");
    } catch {
      setError("网络异常，请检查服务是否启动后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-inner">
      <div className="auth-page-head">
        <h1 className="blog-page-title">WITWEB</h1>
        <p className="app-page-subtitle">登录</p>
      </div>

      <form className="card auth-page-card form w-full p-8" onSubmit={handleLogin}>
        <label className="block mb-4">
          <span className="block mb-1 font-medium">账号</span>
          <input
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入账号"
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
        {turnstileEnabled && (
          <div className="mb-6">
            <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />
          </div>
        )}
        {error && (
          <p className="text-accent mb-4 text-sm bg-accent/10 p-3 rounded border border-accent/20">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
          <div className="flex justify-between mt-2">
            <Link className="btn-ghost text-sm" href="/">
              ← 返回主页
            </Link>
            <Link className="btn-ghost text-sm" href="/register">
              注册账号 →
            </Link>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
