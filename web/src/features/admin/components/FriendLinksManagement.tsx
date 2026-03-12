/**
 * FriendLinksManagement - 友链管理页面组件
 *
 * 提供友链（友情链接）管理功能，包括：
 * - 创建新友链
 * - 编辑友链信息（名称、网址、描述、图标、排序）
 * - 启用/禁用友链
 * - 删除友链
 *
 * @component
 * @example
 * <FriendLinksManagement />
 */
"use client";

import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { del, get, post, put } from "@/lib/api-client";
import { getVersionedApiPath } from "@/lib/api-version";
import { queryKeys } from "@/lib/query-keys";
import AdminNotice from "./AdminNotice";
import { shouldBypassImageOptimization } from "@/utils/url";

interface FriendLink {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  sort_order: number;
  is_active: number;
}

type FriendLinksResponse = {
  links: FriendLink[];
};

type FriendLinkForm = {
  name: string;
  url: string;
  description: string;
  avatar_url: string;
  sort_order: number;
  is_active: number;
};

export default function FriendLinksManagement() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [formData, setFormData] = useState<FriendLinkForm>({
    name: "",
    url: "",
    description: "",
    avatar_url: "",
    sort_order: 0,
    is_active: 1,
  });
  const [editFormData, setEditFormData] = useState<FriendLinkForm>({
    name: "",
    url: "",
    description: "",
    avatar_url: "",
    sort_order: 0,
    is_active: 1,
  });

  const showError = (msg: string) => {
    setNoticeTone("error");
    setMessage(msg);
  };

  const showSuccess = (msg: string) => {
    setNoticeTone("success");
    setMessage(msg);
  };

  const clearNotice = () => {
    setNoticeTone("info");
    setMessage("");
  };

  const getFallbackIcon = (siteUrl: string) => {
    try {
      return `${new URL(siteUrl).origin}/favicon.ico`;
    } catch {
      return "";
    }
  };

  const linksQuery = useQuery({
    queryKey: queryKeys.adminFriendLinks,
    queryFn: () => get<FriendLinksResponse>(getVersionedApiPath("/friend-links")),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (payload: FriendLinkForm) =>
      post<{ id: number; message: string }>(
        getVersionedApiPath("/friend-links"),
        {
          ...payload,
          avatar_url: payload.avatar_url.trim() || null,
        },
      ),
    onSuccess: async () => {
      setFormData({
        name: "",
        url: "",
        description: "",
        avatar_url: "",
        sort_order: 0,
        is_active: 1,
      });
      showSuccess("友链创建成功");
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminFriendLinks });
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "保存失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: FriendLinkForm }) =>
      put<{ message: string }>(
        getVersionedApiPath(`/friend-links/${payload.id}`),
        {
          ...payload.data,
          avatar_url: payload.data.avatar_url.trim() || null,
        },
      ),
    onSuccess: async () => {
      setEditModalOpen(false);
      setEditingId(null);
      showSuccess("友链更新成功");
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminFriendLinks });
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "保存失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => del<{ message: string }>(getVersionedApiPath(`/friend-links/${id}`)),
    onSuccess: async () => {
      setPendingDeleteId(null);
      showSuccess("删除成功");
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminFriendLinks });
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "删除失败");
    },
  });

  const links = linksQuery.data?.links || [];
  const loading = linksQuery.isLoading;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync(formData);
  };

  const handleEdit = (link: FriendLink) => {
    setEditingId(link.id);
    setEditFormData({
      name: link.name,
      url: link.url,
      description: link.description || "",
      avatar_url: link.avatar_url || "",
      sort_order: link.sort_order,
      is_active: link.is_active,
    });
    setEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingId(null);
  };

  if (loading) return <div className="admin-loading">加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">友链管理</h1>
        <p className="page-subtitle">管理友情链接</p>
      </div>

      <AdminNotice message={message} tone={noticeTone} />

      <div className="admin-card">
        <div className="card-header">
          <h3 className="card-title">新增友链</h3>
        </div>
        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <input type="text" className="admin-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="名称 *" required />
            <input type="url" className="admin-input" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="网址 *（https://example.com）" required />
            <input type="url" className="admin-input" value={formData.avatar_url} onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })} placeholder="站点图标 URL（可选）" />
            <input type="number" className="admin-input" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })} placeholder="排序" />
            <select className="admin-select" value={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value, 10) })}>
              <option value={1}>启用</option>
              <option value={0}>禁用</option>
            </select>
          </div>

          <textarea
            className="admin-input"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="描述（可选）"
            style={{ marginBottom: "0.75rem" }}
          />

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="submit" className="btn-admin btn-admin-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? "保存中..." : "新增友链"}
            </button>
            <button type="button" className="btn-admin btn-admin-secondary" onClick={clearNotice}>
              清空提示
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h3 className="card-title">友链列表</h3>
          <span>共 {links.length} 条</span>
        </div>

        {links.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">暂无友链</div>
            <div className="empty-state-subtext">可在上方创建第一条友链。</div>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 72 }}>图标</th>
                <th>名称</th>
                <th>网址</th>
                <th>描述</th>
                <th style={{ width: 100 }}>排序</th>
                <th style={{ width: 90 }}>状态</th>
                <th style={{ width: 260 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    {link.avatar_url || getFallbackIcon(link.url) ? (
                      <Image
                        src={link.avatar_url || getFallbackIcon(link.url)}
                        alt={link.name}
                        width={34}
                        height={34}
                        style={{ borderRadius: 999, objectFit: "cover" }}
                        unoptimized={shouldBypassImageOptimization(link.avatar_url || getFallbackIcon(link.url))}
                      />
                    ) : (
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          background: "linear-gradient(135deg, #3b82f6, #22d3ee)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {link.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td>{link.name}</td>
                  <td style={{ maxWidth: 260 }}>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ color: "var(--text-accent)" }}>
                      {link.url}
                    </a>
                  </td>
                  <td>{link.description || "-"}</td>
                  <td>{link.sort_order}</td>
                  <td>
                    <span className={`badge ${link.is_active === 1 ? "badge-success" : "badge-warning"}`}>
                      {link.is_active === 1 ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button className="btn-admin btn-admin-secondary" onClick={() => handleEdit(link)}>
                        编辑
                      </button>
                      {pendingDeleteId === link.id ? (
                        <>
                          <button className="btn-admin btn-admin-danger" onClick={() => void deleteMutation.mutateAsync(link.id)}>
                            确认删除
                          </button>
                          <button className="btn-admin btn-admin-secondary" onClick={() => setPendingDeleteId(null)}>
                            取消
                          </button>
                        </>
                      ) : (
                        <button className="btn-admin btn-admin-danger" onClick={() => setPendingDeleteId(link.id)}>
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editModalOpen && editingId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "680px" }}>
            <div className="modal-header">
              <h3>编辑友链</h3>
              <button className="close-btn" type="button" onClick={handleCancelEdit}>
                &times;
              </button>
            </div>
            <div className="create-key-form">
              <div className="form-group">
                <label>名称</label>
                <input type="text" className="admin-input" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>网址</label>
                <input type="url" className="admin-input" value={editFormData.url} onChange={(e) => setEditFormData({ ...editFormData, url: e.target.value })} />
              </div>
              <div className="form-group">
                <label>站点图标 URL（可选）</label>
                <input type="url" className="admin-input" value={editFormData.avatar_url} onChange={(e) => setEditFormData({ ...editFormData, avatar_url: e.target.value })} />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea className="admin-input" rows={3} value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                <div className="form-group">
                  <label>排序</label>
                  <input type="number" className="admin-input" value={editFormData.sort_order} onChange={(e) => setEditFormData({ ...editFormData, sort_order: parseInt(e.target.value, 10) || 0 })} />
                </div>
                <div className="form-group">
                  <label>状态</label>
                  <select className="admin-select" value={editFormData.is_active} onChange={(e) => setEditFormData({ ...editFormData, is_active: parseInt(e.target.value, 10) })}>
                    <option value={1}>启用</option>
                    <option value={0}>禁用</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-admin btn-admin-secondary" type="button" onClick={handleCancelEdit}>
                  取消
                </button>
                <button
                  className="btn-admin btn-admin-primary"
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => editingId && void updateMutation.mutateAsync({ id: editingId, data: editFormData })}
                >
                  {updateMutation.isPending ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
