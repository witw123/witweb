"use client";

import { useEffect, useState } from "react";

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => loadUsers();
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [page, search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search ? { search } : {}),
      });

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`确定要删除用户 ${username} 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/users/${username}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("用户删除成功");
        loadUsers();
      } else {
        alert("删除失败");
      }
    } catch (error: any) {
      alert(`删除失败: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">用户管理</h1>
        <p className="page-subtitle">管理所有注册用户</p>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <input
            type="text"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input"
            style={{ width: "300px" }}
          />
          <div>共 {total} 个用户</div>
        </div>

        {loading ? null : (
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
                  <td><strong>{user.username}</strong></td>
                  <td>{new Date(user.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <span className={`badge badge-${user.status === "active" ? "success" : "warning"}`}>
                      {user.status || "active"}
                    </span>
                  </td>
                  <td>
                    {user.username !== "witw" && (
                      <button
                        onClick={() => handleDelete(user.username)}
                        className="btn-admin btn-admin-danger"
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        删除
                      </button>
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

