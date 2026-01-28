import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as authService from "../services/authService";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码");
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(username, password);
      // Update AuthContext state immediately
      login(data.token, data.profile);
      navigate("/");
    } catch (err) {
      setError(err.message || "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Studio</h1>
        <p className="text-secondary">登录 · 进入工作区</p>
      </div>

      <form className="card form w-full max-w-md p-8 shadow-lg" onSubmit={handleLogin}>
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
        {error && <p className="text-accent mb-4 text-sm bg-accent/10 p-3 rounded border border-accent/20">{error}</p>}
        <div className="flex flex-col gap-3">
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
          <div className="flex justify-between mt-2">
            <Link className="btn-ghost text-sm" to="/">
              ← 返回主页
            </Link>
            <Link className="btn-ghost text-sm" to="/register">
              注册账号 →
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
