"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resizeImageToDataUrl } from "@/utils/image";
import { useAuth } from "@/app/providers";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

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
      setError("密码至少需要6位字符");
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
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "注册失败，请稍后重试");
        return;
      }
      const data = await res.json();
      if (data.token && data.profile) {
        login(data.token, data.profile);
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Studio</h1>
        <p className="text-secondary">注册后自动登录</p>
      </div>

      <form className="card form w-full max-w-md p-8 shadow-lg" onSubmit={handleRegister}>
        <label className="block mb-4">
          <span className="block mb-1 font-medium">账号</span>
          <input
            className="input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="设置账号"
          />
        </label>
        <label className="block mb-4">
          <span className="block mb-1 font-medium">昵称</span>
          <input
            className="input"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="显示昵称"
          />
        </label>
        <label className="block mb-4">
          <span className="block mb-1 font-medium">头像</span>
          <div className="flex items-center gap-4">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-accent"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-opacity-90 cursor-pointer"
            />
          </div>
        </label>
        <label className="block mb-6">
          <span className="block mb-1 font-medium">密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="设置密码"
          />
        </label>
        {error && (
          <p className="text-accent mb-4 text-sm bg-accent/10 p-3 rounded border border-accent/20">
            {error}
          </p>
        )}
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
  );
}
