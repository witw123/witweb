"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface FriendLink {
  id: number;
  name: string;
  url: string;
  description: string | null;
  avatar_url: string | null;
  sort_order: number;
  is_active: number;
}

export default function FriendLinksManagement() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    avatar_url: "",
    sort_order: 0,
    is_active: 1,
  });

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
        setMessage(data.error?.message || "加载友链失败");
        return;
      }
      setLinks(data.data?.links || []);
      setMessage("");
    } catch {
      setMessage("加载友链失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLinks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const endpoint = editingId ? `/api/friend-links/${editingId}` : "/api/friend-links";
      const method = editingId ? "PUT" : "POST";
      const normalizedAvatar = formData.avatar_url.trim();
      const payload = {
        ...formData,
        avatar_url: normalizedAvatar || null,
      };

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.success !== undefined && !data.success)) {
        setMessage(data.error?.message || "保存失败");
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
      setEditingId(null);
      setMessage(editingId ? "友链更新成功" : "友链创建成功");
      void fetchLinks();
    } catch {
      setMessage("保存失败");
    }
  };

  const handleEdit = (link: FriendLink) => {
    setEditingId(link.id);
    setFormData({
      name: link.name,
      url: link.url,
      description: link.description || "",
      avatar_url: link.avatar_url || "",
      sort_order: link.sort_order,
      is_active: link.is_active,
    });
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
        setMessage(data.error?.message || "删除失败");
        return;
      }
      setPendingDeleteId(null);
      setMessage("删除成功");
      void fetchLinks();
    } catch {
      setMessage("删除失败");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      name: "",
      url: "",
      description: "",
      avatar_url: "",
      sort_order: 0,
      is_active: 1,
    });
  };

  if (loading) return <div className="py-8 text-center">加载中...</div>;

  return (
    <div className="space-y-6">
      {message && <div className="card"><p>{message}</p></div>}

      <div className="card">
        <h2 className="mb-4 text-xl font-bold">{editingId ? "编辑友链" : "添加友链"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">名称 *</label>
            <input type="text" className="input w-full" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">网址 *</label>
            <input type="url" className="input w-full" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://example.com" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">描述</label>
            <textarea className="input w-full" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="简短描述这个网站..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">站点图标 URL（可选）</label>
            <input type="url" className="input w-full" value={formData.avatar_url} onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })} placeholder="留空将自动尝试抓取网站图标" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">排序</label>
              <input type="number" className="input w-full" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">状态</label>
              <select className="input w-full" value={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value, 10) })}>
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? "保存修改" : "添加友链"}</button>
            {editingId && <button type="button" className="btn-ghost" onClick={handleCancel}>取消</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-4 text-xl font-bold">友链列表</h2>
        {links.length === 0 ? (
          <p className="py-8 text-center text-muted">暂无友链</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between rounded-lg border border-subtle p-4 transition-colors hover:border-blue-500/50">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {link.avatar_url || getFallbackIcon(link.url) ? (
                    <Image
                      src={link.avatar_url || getFallbackIcon(link.url)}
                      alt={link.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 font-bold text-white">
                      {link.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{link.name}</h3>
                      {link.is_active === 0 && <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">已禁用</span>}
                    </div>
                    <p className="truncate text-sm text-muted">{link.url}</p>
                    {link.description && <p className="mt-1 line-clamp-1 text-xs text-muted">{link.description}</p>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => handleEdit(link)}>编辑</button>
                  {pendingDeleteId === link.id ? (
                    <>
                      <button className="btn-ghost btn-sm text-red-400 hover:text-red-300" onClick={() => void handleDelete(link.id)}>确认删除</button>
                      <button className="btn-ghost btn-sm" onClick={() => setPendingDeleteId(null)}>取消</button>
                    </>
                  ) : (
                    <button className="btn-ghost btn-sm text-red-400 hover:text-red-300" onClick={() => setPendingDeleteId(link.id)}>删除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
