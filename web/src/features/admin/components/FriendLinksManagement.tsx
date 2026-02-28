"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AdminNotice from "./AdminNotice";

interface FriendLink {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  sort_order: number;
  is_active: number;
}

type FriendLinkForm = {
  name: string;
  url: string;
  description: string;
  avatar_url: string;
  sort_order: number;
  is_active: number;
};

export default function FriendLinksManagement() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchLinks = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/friend-links", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setLinks([]);
        showError(data.error?.message || "加载友链失败");
        return;
      }
      setLinks(data.data?.links || []);
      clearNotice();
    } catch {
      showError("加载友链失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLinks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const normalizedAvatar = formData.avatar_url.trim();
      const payload = {
        ...formData,
        avatar_url: normalizedAvatar || null,
      };

      const res = await fetch("/api/friend-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success !== undefined && !data.success)) {
        showError(data.error?.message || "保存失败");
        return;
      }

      setFormData({
        name: "",
        url: "",
        description: "",
        avatar_url: "",
        sort_order: 0,
        is_active: 1,
      });
      showSuccess("友链创建成功");
      void fetchLinks();
    } catch {
      showError("保存失败");
    }
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

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const token = localStorage.getItem("token");
      const normalizedAvatar = editFormData.avatar_url.trim();
      const payload = {
        ...editFormData,
        avatar_url: normalizedAvatar || null,
      };

      const res = await fetch(`/api/friend-links/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success !== undefined && !data.success)) {
        showError(data.error?.message || "保存失败");
        return;
      }

      setEditModalOpen(false);
      setEditingId(null);
      showSuccess("友链更新成功");
      void fetchLinks();
    } catch {
      showError("保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/friend-links/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success !== undefined && !data.success)) {
        showError(data.error?.message || "删除失败");
        return;
      }
      setPendingDeleteId(null);
      showSuccess("删除成功");
      void fetchLinks();
    } catch {
      showError("删除失败");
    }
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
            <input
              type="text"
              className="admin-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="名称 *"
              required
            />
            <input
              type="url"
              className="admin-input"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="网址 *（https://example.com）"
              required
            />
            <input
              type="url"
              className="admin-input"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              placeholder="站点图标 URL（可选）"
            />
            <input
              type="number"
              className="admin-input"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })}
              placeholder="排序"
            />
            <select
              className="admin-select"
              value={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value, 10) })}
            >
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
            <button type="submit" className="btn-admin btn-admin-primary">
              新增友链
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
                        unoptimized
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
                          <button className="btn-admin btn-admin-danger" onClick={() => void handleDelete(link.id)}>
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
                <input
                  type="text"
                  className="admin-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>网址</label>
                <input
                  type="url"
                  className="admin-input"
                  value={editFormData.url}
                  onChange={(e) => setEditFormData({ ...editFormData, url: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>站点图标 URL（可选）</label>
                <input
                  type="url"
                  className="admin-input"
                  value={editFormData.avatar_url}
                  onChange={(e) => setEditFormData({ ...editFormData, avatar_url: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <div className="form-group">
                  <label>排序</label>
                  <input
                    type="number"
                    className="admin-input"
                    value={editFormData.sort_order}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        sort_order: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>状态</label>
                  <select
                    className="admin-select"
                    value={editFormData.is_active}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        is_active: parseInt(e.target.value, 10),
                      })
                    }
                  >
                    <option value={1}>启用</option>
                    <option value={0}>禁用</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-admin btn-admin-secondary" type="button" onClick={handleCancelEdit}>
                  取消
                </button>
                <button className="btn-admin btn-admin-primary" type="button" onClick={() => void handleSaveEdit()}>
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
