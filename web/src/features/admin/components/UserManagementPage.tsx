"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { del, get, post, put } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { getRoleLabel, normalizeRole, type AppRole } from "@/lib/rbac";
import { ADMIN_LIST_PAGE_SIZE } from "@/features/admin/constants";
import AdminNotice from "./AdminNotice";

type AdminUser = {
  username: string;
  created_at: string;
  role?: "super_admin" | "content_reviewer" | "operator" | "admin" | "user" | "bot";
  activity_status?: "active" | "inactive";
};

type UserListResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  size: number;
};

type AdminPermissionsResponse = {
  role: AppRole;
};

const activityStatusLabel: Record<"active" | "inactive", string> = {
  active: "活跃",
  inactive: "不活跃",
};

export default function UserManagementPage() {
  const { user: currentUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [sort, setSort] = useState("created_at_desc");
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<string | null>(null);
  const [roleDraftOverrides, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [selectedUsernamesState, setSelectedUsernames] = useState<string[]>([]);
  const [batchDeleteConfirming, setBatchDeleteConfirming] = useState(false);

  const filters = useMemo(
    () => ({
      page,
      limit: ADMIN_LIST_PAGE_SIZE,
      search: search.trim(),
      role: roleFilter,
      activity: activityFilter,
      sort,
    }),
    [page, search, roleFilter, activityFilter, sort],
  );

  const showError = (msg: string) => {
    setNoticeTone("error");
    setMessage(msg);
  };

  const showSuccess = (msg: string) => {
    setNoticeTone("success");
    setMessage(msg);
  };

  const permissionsQuery = useQuery({
    queryKey: queryKeys.adminPermissions,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    queryFn: () => get<AdminPermissionsResponse>("/api/admin/me/permissions"),
  });

  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers(filters),
    enabled: isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.role) params.set("role", filters.role);
      if (filters.activity) params.set("activity", filters.activity);
      if (filters.sort) params.set("sort", filters.sort);
      return get<UserListResponse>(`/api/admin/users?${params.toString()}`);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers(filters) });
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [filters, queryClient]);

  const currentRole = permissionsQuery.data?.role || normalizeRole(currentUser?.role);

  const deleteMutation = useMutation({
    mutationFn: (username: string) => del<{ ok: true }>(`/api/admin/users/${username}`),
    onSuccess: async () => {
      setPendingDeleteUser(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers(filters) });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (input: { username: string; role: AppRole }) =>
      put<{ ok: true }>(`/api/admin/users/${input.username}`, { role: input.role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers(filters) });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (usernames: string[]) =>
      post<{ ok: true; deleted: number }>(
        "/api/admin/users",
        { action: "delete", usernames },
      ),
    onSuccess: async () => {
      setSelectedUsernames([]);
      setBatchDeleteConfirming(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers(filters) });
    },
  });

  const users = useMemo(() => usersQuery.data?.items || [], [usersQuery.data?.items]);
  const selectedUsernames = useMemo(
    () =>
      selectedUsernamesState.filter((username) =>
        users.some((item) => item.username === username)
      ),
    [selectedUsernamesState, users]
  );
  const roleDrafts = useMemo(() => {
    const nextDrafts: Record<string, AppRole> = {};
    for (const item of users) {
      nextDrafts[item.username] =
        roleDraftOverrides[item.username] || normalizeRole(item.role);
    }
    return nextDrafts;
  }, [roleDraftOverrides, users]);
  const total = usersQuery.data?.total || 0;
  const loading = usersQuery.isLoading;

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

  const handleDelete = async (username: string) => {
    try {
      await deleteMutation.mutateAsync(username);
      showSuccess(`用户 ${username} 删除成功`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleUpdateRole = async (target: AdminUser) => {
    const nextRole = roleDrafts[target.username];
    if (!nextRole) return;
    try {
      await updateRoleMutation.mutateAsync({ username: target.username, role: nextRole });
      showSuccess(`用户 ${target.username} 角色已更新为 ${getRoleLabel(nextRole)}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "角色更新失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUsernames.length === 0) {
      showError("请先选择至少一个用户");
      return;
    }
    try {
      const data = await batchDeleteMutation.mutateAsync(selectedUsernames);
      showSuccess(`批量删除完成，共删除 ${data.deleted ?? 0} 个用户`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "批量删除失败");
    }
  };

  const selectableUsers = users
    .filter((item) => item.username !== "witw" && item.role !== "admin" && item.role !== "super_admin")
    .map((item) => item.username);
  const allCurrentPageSelected = selectableUsers.length > 0 && selectableUsers.every((item) => selectedUsernames.includes(item));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">用户管理</h1>
        <p className="page-subtitle">管理所有注册用户</p>
      </div>

      <div className="admin-card">
        <AdminNotice message={message} tone={noticeTone} />

        <div className="card-header admin-user-toolbar">
          <input
            type="text"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-input admin-user-search"
          />
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="admin-select">
            <option value="">全部角色</option>
            <option value="super_admin">{getRoleLabel("super_admin")}</option>
            <option value="content_reviewer">{getRoleLabel("content_reviewer")}</option>
            <option value="operator">{getRoleLabel("operator")}</option>
            <option value="admin">{getRoleLabel("admin")}</option>
            <option value="user">{getRoleLabel("user")}</option>
            <option value="bot">{getRoleLabel("bot")}</option>
          </select>
          <select value={activityFilter} onChange={(e) => { setActivityFilter(e.target.value); setPage(1); }} className="admin-select">
            <option value="">全部活跃状态</option>
            <option value="active">活跃（近30天）</option>
            <option value="inactive">不活跃（近30天）</option>
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="admin-select">
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

        <div className="admin-user-batch-bar">
          <span className="admin-user-batch-count">已选 {selectedUsernames.length} 个用户</span>
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
            <button className="btn-admin btn-admin-secondary" type="button" onClick={() => setBatchDeleteConfirming(false)}>
              取消
            </button>
          )}
        </div>

        {!loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-table-col-checkbox">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setSelectedUsernames((prev) => prev.filter((username) => !selectableUsers.includes(username)));
                        return;
                      }
                      setSelectedUsernames((prev) => Array.from(new Set([...prev, ...selectableUsers])));
                    }}
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
                    {selectableUsers.includes(user.username) && (
                      <input
                        type="checkbox"
                        checked={selectedUsernames.includes(user.username)}
                        onChange={(e) =>
                          setSelectedUsernames((prev) =>
                            e.target.checked ? Array.from(new Set([...prev, user.username])) : prev.filter((item) => item !== user.username),
                          )
                        }
                      />
                    )}
                  </td>
                  <td><strong>{user.username}</strong></td>
                  <td>
                    <span className={`badge badge-${user.role === "admin" || user.role === "super_admin" ? "danger" : user.role === "bot" ? "warning" : "success"}`}>
                      {getRoleLabel(normalizeRole(user.role))}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <span className={`badge badge-${(user.activity_status || "inactive") === "active" ? "success" : "warning"}`}>
                      {activityStatusLabel[user.activity_status || "inactive"]}
                    </span>
                  </td>
                  <td>
                    {canManageTarget(user) && (
                      <div className="admin-user-actions">
                        <select
                          value={roleDrafts[user.username] || normalizeRole(user.role)}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [user.username]: normalizeRole(e.target.value),
                            }))
                          }
                          className="admin-select admin-user-role-select"
                        >
                          {roleOptionsByActor[currentRole].map((role) => (
                            <option key={role} value={role}>{getRoleLabel(role)}</option>
                          ))}
                        </select>
                        <button onClick={() => void handleUpdateRole(user)} className="btn-admin btn-admin-secondary admin-user-action-btn admin-user-action-btn-wide">
                          保存角色
                        </button>
                        {pendingDeleteUser === user.username ? (
                          <>
                            <button onClick={() => void handleDelete(user.username)} className="btn-admin btn-admin-danger admin-user-action-btn">
                              确认删除
                            </button>
                            <button onClick={() => setPendingDeleteUser(null)} className="btn-admin btn-admin-secondary admin-user-action-btn">
                              取消
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setPendingDeleteUser(user.username)} className="btn-admin btn-admin-danger admin-user-action-btn">
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
          <div className="admin-table-pagination">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-admin btn-admin-secondary">上一页</button>
            <span className="admin-table-pagination-label">第 {page} 页</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * ADMIN_LIST_PAGE_SIZE >= total} className="btn-admin btn-admin-secondary">下一页</button>
          </div>
        )}
      </div>
    </div>
  );
}
