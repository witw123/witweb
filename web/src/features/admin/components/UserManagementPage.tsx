"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNotice from "./AdminNotice";
import { useAuth } from "@/app/providers";
import { getRoleLabel, normalizeRole, type AppRole } from "@/lib/rbac";
import { ADMIN_LIST_PAGE_SIZE } from "@/features/admin/constants";

type AdminUser = {
  username: string;
  created_at: string;
  role?: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot";
  activity_status?: "active" | "inactive";
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [sort, setSort] = useState("created_at_desc");
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [batchDeleteConfirming, setBatchDeleteConfirming] = useState(false);
  const [resolvedCurrentRole, setResolvedCurrentRole] = useState<AppRole | null>(null);
  const currentRole = resolvedCurrentRole || normalizeRole(currentUser?.role);
  const showError = (msg: string) => {
    setNoticeTone("error");
    setMessage(msg);
  };
  const showSuccess = (msg: string) => {
    setNoticeTone("success");
    setMessage(msg);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    void fetch("/api/admin/me/permissions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        const role = data?.data?.role;
        if (typeof role === "string") setResolvedCurrentRole(normalizeRole(role));
      })
      .catch(() => {});
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ADMIN_LIST_PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (activityFilter) params.set("activity", activityFilter);
      if (sort) params.set("sort", sort);

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setUsers([]);
        setTotal(0);
        showError(data.error?.message || "加载用户失败");
        return;
      }

      setUsers(data.data?.items || []);
      setTotal(data.data?.total || 0);
      const nextDrafts: Record<string, AppRole> = {};
      for (const item of (data.data?.items || []) as AdminUser[]) {
        nextDrafts[item.username] = normalizeRole(item.role);
      }
      setRoleDrafts(nextDrafts);
      setSelectedUsernames((prev) =>
        prev.filter((username) => (data.data?.items || []).some((item: AdminUser) => item.username === username))
      );
    } catch {
      setUsers([]);
      setTotal(0);
      showError("加载用户失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, activityFilter, sort]);

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
        showSuccess(`用户 ${username} 删除成功`);
        setPendingDeleteUser(null);
        void loadUsers();
        return;
      }

      const data = await response.json().catch(() => ({}));
      showError(data.error?.message || "删除失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      showError(`删除失败: ${message}`);
    }
  };

  const roleOptionsByActor: Record<AppRole, AppRole[]> = {
    super_admin: ["super_admin", "admin", "content_reviewer", "operator", "user", "bot"],
    admin: ["content_reviewer", "operator", "user", "bot"],
    operator: ["user", "bot"],
    content_reviewer: [],
    user: [],
    bot: [],
  };

  const canManageTarget = (target: AdminUser) => {
    const targetRole = normalizeRole(target.role);
    if (target.username === currentUser?.username) return false;
    if (currentRole === "super_admin") return true;
    if (currentRole === "admin") return targetRole !== "super_admin" && targetRole !== "admin";
    if (currentRole === "operator") return targetRole === "user" || targetRole === "bot";
    return false;
  };

  const handleUpdateRole = async (target: AdminUser) => {
    const nextRole = roleDrafts[target.username];
    if (!nextRole) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/users/${target.username}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showError(data.error?.message || "角色更新失败");
        return;
      }
      showSuccess(`用户 ${target.username} 角色已更新为 ${getRoleLabel(nextRole)}`);
      void loadUsers();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : "角色更新失败");
    }
  };

  const toggleSelect = (username: string, checked: boolean) => {
    setSelectedUsernames((prev) => {
      if (checked) return Array.from(new Set([...prev, username]));
      return prev.filter((item) => item !== username);
    });
  };

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    const selectable = users
      .filter((item) => item.username !== "witw" && item.role !== "admin" && item.role !== "super_admin")
      .map((item) => item.username);
    if (!checked) {
      setSelectedUsernames((prev) => prev.filter((username) => !selectable.includes(username)));
      return;
    }
    setSelectedUsernames((prev) => Array.from(new Set([...prev, ...selectable])));
  };

  const handleBatchDelete = async () => {
    if (selectedUsernames.length === 0) {
      showError("请先选择至少一个用户");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          usernames: selectedUsernames,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showError(data.error?.message || "批量删除失败");
        return;
      }

      showSuccess(`批量删除完成，共删除 ${data.data?.deleted ?? 0} 个用户`);
      setSelectedUsernames([]);
      setBatchDeleteConfirming(false);
      void loadUsers();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : "批量删除失败");
    }
  };

  const allCurrentPageSelected =
    users.filter((item) => item.username !== "witw" && item.role !== "admin" && item.role !== "super_admin").length > 0 &&
    users
      .filter((item) => item.username !== "witw" && item.role !== "admin" && item.role !== "super_admin")
      .every((item) => selectedUsernames.includes(item.username));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">用户管理</h1>
        <p className="page-subtitle">管理所有注册用户</p>
      </div>

      <div className="admin-card">
        <AdminNotice message={message} tone={noticeTone} />

        <div className="card-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
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
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="admin-select"
          >
            <option value="">全部角色</option>
            <option value="super_admin">{getRoleLabel("super_admin")}</option>
            <option value="content_reviewer">{getRoleLabel("content_reviewer")}</option>
            <option value="operator">{getRoleLabel("operator")}</option>
            <option value="admin">{getRoleLabel("admin")}</option>
            <option value="user">{getRoleLabel("user")}</option>
            <option value="bot">{getRoleLabel("bot")}</option>
          </select>
          <select
            value={activityFilter}
            onChange={(e) => {
              setActivityFilter(e.target.value);
              setPage(1);
            }}
            className="admin-select"
          >
            <option value="">全部活跃状态</option>
            <option value="active">活跃（近30天）</option>
            <option value="inactive">不活跃（近30天）</option>
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="admin-select"
          >
            <option value="created_at_desc">注册时间（新到旧）</option>
            <option value="created_at_asc">注册时间（旧到新）</option>
            <option value="username_asc">用户名（A-Z）</option>
            <option value="username_desc">用户名（Z-A）</option>
            <option value="role_asc">角色（A-Z）</option>
            <option value="role_desc">角色（Z-A）</option>
          </select>
          <button
            className="btn-admin btn-admin-secondary"
            type="button"
            onClick={() => {
              setSearch("");
              setRoleFilter("");
              setActivityFilter("");
              setSort("created_at_desc");
              setPage(1);
            }}
          >
            清空筛选
          </button>
          <div>共 {total} 个用户</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            已选 {selectedUsernames.length} 个用户
          </span>
          <button
            className="btn-admin btn-admin-danger"
            type="button"
            disabled={selectedUsernames.length === 0}
            onClick={() => {
              if (!batchDeleteConfirming) {
                setBatchDeleteConfirming(true);
                return;
              }
              void handleBatchDelete();
            }}
          >
            {batchDeleteConfirming ? "确认批量删除" : "批量删除"}
          </button>
          {batchDeleteConfirming && (
            <button
              className="btn-admin btn-admin-secondary"
              type="button"
              onClick={() => setBatchDeleteConfirming(false)}
            >
              取消
            </button>
          )}
        </div>

        {!loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={(e) => toggleSelectAllCurrentPage(e.target.checked)}
                  />
                </th>
                <th>用户名</th>
                <th>角色</th>
                <th>注册时间</th>
                <th>活跃状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.username}>
                  <td>
                    {user.username !== "witw" && user.role !== "admin" && user.role !== "super_admin" && (
                      <input
                        type="checkbox"
                        checked={selectedUsernames.includes(user.username)}
                        onChange={(e) => toggleSelect(user.username, e.target.checked)}
                      />
                    )}
                  </td>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>
                    <span className={`badge badge-${user.role === "admin" || user.role === "super_admin" ? "danger" : user.role === "bot" ? "warning" : "success"}`}>
                      {getRoleLabel(normalizeRole(user.role))}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <span className={`badge badge-${(user.activity_status || "inactive") === "active" ? "success" : "warning"}`}>
                      {(user.activity_status || "inactive") === "active" ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    {canManageTarget(user) && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <select
                          className="admin-select"
                          value={roleDrafts[user.username] || normalizeRole(user.role)}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [user.username]: normalizeRole(e.target.value),
                            }))
                          }
                          style={{ minWidth: 130 }}
                        >
                          {roleOptionsByActor[currentRole].map((role) => (
                            <option key={role} value={role}>
                              {getRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void handleUpdateRole(user)}
                          className="btn-admin btn-admin-secondary"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", minWidth: 92 }}
                        >
                          保存角色
                        </button>
                        {pendingDeleteUser === user.username ? (
                          <>
                            <button
                              onClick={() => void handleDelete(user.username)}
                              className="btn-admin btn-admin-danger"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", minWidth: 80 }}
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
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", minWidth: 80 }}
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

        {total > ADMIN_LIST_PAGE_SIZE && (
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
              disabled={page * ADMIN_LIST_PAGE_SIZE >= total}
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
