"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resizeImageToDataUrl } from "@/utils/image";
import { useAuth } from "@/app/providers";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const router = useRouter();
  const { login } = useAuth();
  const turnstileEnabled =
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true" && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setAvatarUrl("");
      return;
    }
    const resized = await resizeImageToDataUrl(file, 256);
    setAvatarUrl(resized || "");
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 位字符");
      return;
    }
    if (turnstileEnabled && !captchaToken) {
      setError("请先完成验证码验证");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          nickname,
          avatar_url: avatarUrl,
          captchaToken,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const detailMessage =
          data.error?.details && typeof data.error.details === "object"
            ? Object.values(data.error.details)[0]
            : "";
        setError((detailMessage as string) || data.error?.message || "注册失败，请稍后重试");
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
          <h1 className="blog-page-title">AI Studio</h1>
          <p className="app-page-subtitle">注册后自动登录</p>
        </div>

        <form className="card auth-page-card form w-full p-8" onSubmit={handleRegister}>
          <label className="mb-4 block">
            <span className="mb-1 block font-medium">账号</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="设置账号"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block font-medium">昵称</span>
            <input
              className="input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="显示昵称（可选）"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block font-medium">头像</span>
            <div className="flex items-center gap-4">
              {avatarUrl && (
                <Image
                  src={avatarUrl}
                  alt="Avatar preview"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full border-2 border-accent object-cover"
                  unoptimized
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="cursor-pointer text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-opacity-90"
              />
            </div>
          </label>

          <label className="mb-6 block">
            <span className="mb-1 block font-medium">密码</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="设置密码（至少 6 位）"
            />
          </label>

          {turnstileEnabled && (
            <div className="mb-6">
              <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />
            </div>
          )}

          {error && <p className="mb-4 rounded border border-accent/20 bg-accent/10 p-3 text-sm text-accent">{error}</p>}

          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? "注册中..." : "注册并登录"}
          </button>

          <div className="mt-4 text-center">
            <Link className="btn-ghost text-sm" href="/login">
              已有账号？直接登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
