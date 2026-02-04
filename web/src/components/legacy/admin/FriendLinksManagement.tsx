"use client";

import { useState, useEffect } from "react";

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
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: "",
    avatar_url: "",
    sort_order: 0,
    is_active: 1,
  });

  const fetchLinks = async () => {
    try {
      const res = await fetch("/api/friend-links");
      const data = await res.json();
      setLinks(data.links || []);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch links:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");

      if (editingId) {
        // Update existing link
        await fetch(`/api/friend-links/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
      } else {
        // Create new link
        await fetch("/api/friend-links", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
      }

      // Reset form and refresh
      setFormData({
        name: "",
        url: "",
        description: "",
        avatar_url: "",
        sort_order: 0,
        is_active: 1,
      });
      setEditingId(null);
      fetchLinks();
    } catch (error) {
      console.error("Failed to save link:", error);
      alert("保存失败");
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
    if (!confirm("确定要删除这个友链吗?")) return;

    try {
      const token = localStorage.getItem("token");

      await fetch(`/api/friend-links/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchLinks();
    } catch (error) {
      console.error("Failed to delete link:", error);
      alert("删除失败");
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

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">
          {editingId ? "编辑友链" : "添加友链"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名称 *</label>
            <input
              type="text"
              className="input w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">链接 *</label>
            <input
              type="url"
              className="input w-full"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              className="input w-full"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="简短描述这个网站..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">头像URL</label>
            <input
              type="url"
              className="input w-full"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">排序</label>
              <input
                type="number"
                className="input w-full"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select
                className="input w-full"
                value={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
              >
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              {editingId ? "更新" : "添加"}
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={handleCancel}>
                取消
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">友链列表</h2>
        {links.length === 0 ? (
          <p className="text-muted text-center py-8">暂无友链</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 border border-subtle rounded-lg hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {link.avatar_url ? (
                    <img
                      src={link.avatar_url}
                      alt={link.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {link.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{link.name}</h3>
                      {link.is_active === 0 && (
                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                          已禁用
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted truncate">{link.url}</p>
                    {link.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-1">
                        {link.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => handleEdit(link)}
                  >
                    编辑
                  </button>
                  <button
                    className="btn-ghost btn-sm text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(link.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
