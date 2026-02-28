"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import AdminNotice from "./AdminNotice";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: number;
  post_count: number;
};

export default function CategoryManagementPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
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

  useEffect(() => {
    if (!token) return;
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function getAuthHeader() {
    const t = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const headers: Record<string, string> = {};
    if (t) headers.Authorization = `Bearer ${t}`;
    return headers;
  }

  async function loadCategories() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/categories?limit=100", {
        headers: getAuthHeader(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setCategories([]);
        showError(data.error?.message || "加载分类失败");
        return;
      }
      setCategories((data.data?.items || []) as Category[]);
      clearNotice();
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    if (!name.trim()) {
      showError("分类名称不能为空");
      return;
    }

    try {
      setSubmitting(true);
      clearNotice();

      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showError(data.error?.message || "创建失败");
        return;
      }

      setName("");
      setSlug("");
      setDescription("");
      showSuccess("创建成功");
      await loadCategories();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: Category) {
    const res = await fetch(`/api/admin/categories/${item.id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: item.is_active ? 0 : 1 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      showError(data.error?.message || "更新失败");
      return;
    }

    showSuccess("状态更新成功");
    await loadCategories();
  }

  async function removeCategory(item: Category) {
    const res = await fetch(`/api/admin/categories/${item.id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      showError(data.error?.message || "删除失败");
      return;
    }

    setPendingDeleteId(null);
    showSuccess("删除成功");
    await loadCategories();
  }

  async function submitEditCategory() {
    if (!editingCategory) return;
    if (!editingCategory.name.trim()) {
      showError("分类名称不能为空");
      return;
    }
    if (!editingCategory.slug.trim()) {
      showError("分类别名不能为空");
      return;
    }

    try {
      setEditSubmitting(true);
      const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingCategory.name.trim(),
          slug: editingCategory.slug.trim(),
          description: (editingCategory.description || "").trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showError(data.error?.message || "更新失败");
        return;
      }

      showSuccess("更新成功");
      setEditingCategory(null);
      await loadCategories();
    } finally {
      setEditSubmitting(false);
    }
  }

  async function move(item: Category, direction: -1 | 1) {
    const index = categories.findIndex((c) => c.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;

    const next = categories.slice();
    const [current] = next.splice(index, 1);
    next.splice(target, 0, current);
    setCategories(next);

    const res = await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: next.map((c) => c.id) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      showError(data.error?.message || "排序失败");
      await loadCategories();
      return;
    }

    showSuccess("排序已更新");
    await loadCategories();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">分类管理</h1>
        <p className="page-subtitle">创建、启停、排序文章分类</p>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h3 className="card-title">新建分类</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 3fr auto", gap: "0.75rem" }}>
          <input className="admin-input" placeholder="分类名称（如：AI）" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="admin-input" placeholder="别名（可选，如：ai）" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <input className="admin-input" placeholder="描述（可选）" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="btn-admin btn-admin-primary" type="button" onClick={createCategory} disabled={submitting}>
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
        <AdminNotice message={message} tone={noticeTone} />
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h3 className="card-title">分类列表</h3>
          <span>共 {categories.length} 个</span>
        </div>
        {loading ? null : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>别名</th>
                <th>文章数</th>
                <th>状态</th>
                <th>排序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item, idx) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.slug}</td>
                  <td>{item.post_count || 0}</td>
                  <td>
                    <span className={`badge ${item.is_active ? "badge-success" : "badge-warning"}`}>
                      {item.is_active ? "启用" : "停用"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-admin btn-admin-secondary" type="button" disabled={idx === 0} onClick={() => void move(item, -1)}>
                        上移
                      </button>
                      <button className="btn-admin btn-admin-secondary" type="button" disabled={idx === categories.length - 1} onClick={() => void move(item, 1)}>
                        下移
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => void toggleActive(item)}>
                        {item.is_active ? "停用" : "启用"}
                      </button>
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => setEditingCategory(item)}>
                        编辑
                      </button>

                      {pendingDeleteId === item.id ? (
                        <>
                          <button className="btn-admin btn-admin-danger" type="button" onClick={() => void removeCategory(item)}>
                            确认删除
                          </button>
                          <button className="btn-admin btn-admin-secondary" type="button" onClick={() => setPendingDeleteId(null)}>
                            取消
                          </button>
                        </>
                      ) : (
                        <button className="btn-admin btn-admin-danger" type="button" onClick={() => setPendingDeleteId(item.id)}>
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

      {editingCategory && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "620px" }}>
            <div className="modal-header">
              <h3>编辑分类</h3>
              <button className="close-btn" onClick={() => setEditingCategory(null)}>
                &times;
              </button>
            </div>
            <div className="create-key-form">
              <div className="form-group">
                <label>分类名称</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>分类别名（slug）</label>
                <input
                  type="text"
                  className="admin-input"
                  value={editingCategory.slug}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>分类描述</label>
                <textarea
                  className="admin-input"
                  rows={4}
                  value={editingCategory.description || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button className="btn-admin btn-admin-secondary" onClick={() => setEditingCategory(null)} disabled={editSubmitting}>
                  取消
                </button>
                <button className="btn-admin btn-admin-primary" onClick={() => void submitEditCategory()} disabled={editSubmitting}>
                  {editSubmitting ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
