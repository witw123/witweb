"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  username: string;
  created_at: string;
  status?: string;
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setUsers([]);
        setTotal(0);
        setMessage(data.error?.message || "加载用户失败");
        return;
      }

      setUsers(data.data?.items || []);
      setTotal(data.data?.total || 0);
    } catch {
      setUsers([]);
      setTotal(0);
      setMessage("加载用户失败");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      void loadUsers();
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [loadUsers]);

  const handleDelete = async (username: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/users/${username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMessage(`用户 ${username} 删除成功`);
        setPendingDeleteUser(null);
        void loadUsers();
        return;
      }

      const data = await response.json().catch(() => ({}));
      setMessage(data.error?.message || "删除失败");
    } catch (error: any) {
      setMessage(`删除失败: ${error.message || "未知错误"}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">用户管理</h1>
        <p className="page-subtitle">管理所有注册用户</p>
      </div>

      <div className="admin-card">
        {message && <p style={{ marginBottom: "0.75rem" }}>{message}</p>}

        <div className="card-header">
          <input
            type="text"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-input"
            style={{ width: "300px" }}
          />
          <div>共 {total} 个用户</div>
        </div>

        {!loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>注册时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.username}>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <span className={`badge badge-${(user.status || "active") === "active" ? "success" : "warning"}`}>
                      {user.status || "active"}
                    </span>
                  </td>
                  <td>
                    {user.username !== "witw" && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {pendingDeleteUser === user.username ? (
                          <>
                            <button
                              onClick={() => void handleDelete(user.username)}
                              className="btn-admin btn-admin-danger"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              确认删除
                            </button>
                            <button
                              onClick={() => setPendingDeleteUser(null)}
                              className="btn-admin btn-admin-secondary"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteUser(user.username)}
                            className="btn-admin btn-admin-danger"
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 20 && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-admin btn-admin-secondary"
            >
              上一页
            </button>
            <span style={{ padding: "0.5rem 1rem" }}>第 {page} 页</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="btn-admin btn-admin-secondary"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
