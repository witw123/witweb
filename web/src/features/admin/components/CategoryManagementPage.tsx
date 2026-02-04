"use client";

import { useEffect, useState } from "react";

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/categories?limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories((data.categories || []) as Category[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    if (!name.trim()) {
      setMessage("分类名称不能为空");
      return;
    }
    try {
      setSubmitting(true);
      setMessage("");
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail || "创建失败");
        return;
      }
      setName("");
      setSlug("");
      setDescription("");
      setMessage("创建成功");
      loadCategories();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: Category) {
    const token = localStorage.getItem("token");
    await fetch(`/api/admin/categories/${item.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: item.is_active ? 0 : 1 }),
    });
    loadCategories();
  }

  async function removeCategory(item: Category) {
    if (!confirm(`确定删除分类“${item.name}”？`)) return;
    const token = localStorage.getItem("token");
    await fetch(`/api/admin/categories/${item.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadCategories();
  }

  async function editCategory(item: Category) {
    const nextName = prompt("分类名称", item.name);
    if (nextName === null) return;
    const nextSlug = prompt("分类别名（slug）", item.slug);
    if (nextSlug === null) return;
    const nextDescription = prompt("分类描述", item.description || "");
    if (nextDescription === null) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/categories/${item.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nextName.trim(),
        slug: nextSlug.trim(),
        description: nextDescription.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.detail || "更新失败");
      return;
    }
    setMessage("更新成功");
    loadCategories();
  }

  async function move(item: Category, direction: -1 | 1) {
    const index = categories.findIndex((c) => c.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const next = categories.slice();
    const [current] = next.splice(index, 1);
    next.splice(target, 0, current);
    setCategories(next);

    const token = localStorage.getItem("token");
    await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: next.map((c) => c.id) }),
    });
    loadCategories();
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
          <input
            className="admin-input"
            placeholder="分类名称（如：AI）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="admin-input"
            placeholder="别名（可选，如：ai）"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <input
            className="admin-input"
            placeholder="描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button className="btn-admin btn-admin-primary" type="button" onClick={createCategory} disabled={submitting}>
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
        {message && <p style={{ marginTop: "0.75rem" }}>{message}</p>}
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
                      <button className="btn-admin btn-admin-secondary" type="button" disabled={idx === 0} onClick={() => move(item, -1)}>
                        上移
                      </button>
                      <button className="btn-admin btn-admin-secondary" type="button" disabled={idx === categories.length - 1} onClick={() => move(item, 1)}>
                        下移
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => toggleActive(item)}>
                        {item.is_active ? "停用" : "启用"}
                      </button>
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => editCategory(item)}>
                        编辑
                      </button>
                      <button className="btn-admin btn-admin-danger" type="button" onClick={() => removeCategory(item)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
