import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
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
      setError(data.detail || "注册失败，请重试。");
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    if (data.profile) {
      localStorage.setItem("profile", JSON.stringify(data.profile));
    }
    navigate("/admin");
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Sora2 Studio Pro</h1>
          <p className="muted">管理员注册 · 注册后自动登录</p>
        </div>
      </header>

      <form className="card form" onSubmit={handleRegister}>
        <label>
          账号
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="设置账号"
          />
        </label>
        <label>
          昵称
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="显示昵称"
          />
        </label>
        <label>
          头像 URL
          <input
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="设置密码"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button primary" type="submit">
          注册并登录
        </button>
      </form>
    </div>
  );
}
