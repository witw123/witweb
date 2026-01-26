import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      setError("Invalid username or password.");
      return;
    }
    const data = await res.json();
    localStorage.setItem("token", data.token);
    if (data.profile) {
      localStorage.setItem("profile", JSON.stringify(data.profile));
    }
    navigate("/");
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>AI Studio</h1>
          <p className="muted">登录 · 进入工作区</p>
        </div>
      </header>

      <form className="card form" onSubmit={handleLogin}>
        <label>
          账号
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入账号"
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
          />
        </label>
        {error && <p className="error">账号或密码错误。</p>}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="button primary" type="submit">
            登录
          </button>
          <a className="button ghost" href="/" rel="noreferrer">
            返回主页
          </a>
          <a className="button ghost" href="/register" target="_blank" rel="noreferrer">
            注册
          </a>
        </div>
      </form>
    </div>
  );
}
