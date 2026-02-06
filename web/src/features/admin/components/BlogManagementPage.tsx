"use client";

import { useCallback, useEffect, useState } from "react";

type BlogItem = {
  id: number;
  username: string;
  title: string;
  status: "published" | "draft";
  category_name?: string | null;
  created_at: string;
};

type BlogDetail = {
  id: number;
  title: string;
  content: string;
  tags?: string;
  category_id?: number | null;
};

type Category = {
  id: number;
  name: string;
};

export default function BlogManagementPage() {
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");

  const [editingBlog, setEditingBlog] = useState<BlogDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const loadBlogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/admin/blogs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setBlogs([]);
        setTotal(0);
        setMessage(data.error?.message || "加载文章失败");
        return;
      }

      setBlogs(data.data?.items || []);
      setTotal(data.data?.total || 0);
    } catch {
      setBlogs([]);
      setTotal(0);
      setMessage("加载文章失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const loadCategories = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/categories?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setCategories([]);
        return;
      }
      setCategories(data.data?.items || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadBlogs();
  }, [loadBlogs]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      void loadBlogs();
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [loadBlogs]);

  const handleEdit = async (blogId: number) => {
    try {
      setEditLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setMessage(data.error?.message || "获取文章详情失败");
        return;
      }
      setEditingBlog(data.data);
      setIsEditModalOpen(true);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBlog) return;

    try {
      setEditLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${editingBlog.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editingBlog.title,
          content: editingBlog.content,
          tags: editingBlog.tags,
          category_id: editingBlog.category_id || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setMessage(data.error?.message || "更新失败");
        return;
      }
      setMessage("更新成功");
      setIsEditModalOpen(false);
      void loadBlogs();
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (blogId: number, title: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMessage(`文章《${title}》已删除`);
        setPendingDeleteId(null);
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      setMessage(data.error?.message || "删除失败");
    } catch (error: any) {
      setMessage(`删除失败: ${error.message || "未知错误"}`);
    }
  };

  const handleStatusChange = async (blogId: number, newStatus: "published" | "draft") => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setMessage("状态更新成功");
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      setMessage(data.error?.message || "更新失败");
    } catch (error: any) {
      setMessage(`更新失败: ${error.message || "未知错误"}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">文章管理</h1>
        <p className="page-subtitle">管理站内全部文章</p>
      </div>

      <div className="admin-card">
        {message && <p style={{ marginBottom: "0.75rem" }}>{message}</p>}

        <div className="card-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <input
            type="text"
            placeholder="搜索文章..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-input"
            style={{ width: "300px" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="admin-select"
          >
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
          <div style={{ marginLeft: "auto" }}>共 {total} 篇文章</div>
        </div>

        {!loading && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>作者</th>
                <th>分类</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>
                    <strong>{blog.title}</strong>
                  </td>
                  <td>{blog.username}</td>
                  <td>{blog.category_name || "未分类"}</td>
                  <td>
                    <span className={`badge badge-${blog.status === "published" ? "success" : "warning"}`}>
                      {blog.status === "published" ? "已发布" : "草稿"}
                    </span>
                  </td>
                  <td>{new Date(blog.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => void handleEdit(blog.id)}
                        className="btn-admin btn-admin-primary"
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        编辑
                      </button>
                      {blog.status === "draft" && (
                        <button
                          onClick={() => void handleStatusChange(blog.id, "published")}
                          className="btn-admin btn-admin-secondary"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          发布
                        </button>
                      )}
                      {blog.status === "published" && (
                        <button
                          onClick={() => void handleStatusChange(blog.id, "draft")}
                          className="btn-admin btn-admin-secondary"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          撤回
                        </button>
                      )}

                      {pendingDeleteId === blog.id ? (
                        <>
                          <button
                            onClick={() => void handleDelete(blog.id, blog.title)}
                            className="btn-admin btn-admin-danger"
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                          >
                            确认删除
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="btn-admin btn-admin-secondary"
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteId(blog.id)}
                          className="btn-admin btn-admin-danger"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
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

      {isEditModalOpen && editingBlog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <h3>编辑文章</h3>
              <button className="close-btn" onClick={() => setIsEditModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="create-key-form">
              <div className="form-group">
                <label>标题</label>
                <input
                  type="text"
                  value={editingBlog.title || ""}
                  onChange={(e) => setEditingBlog({ ...editingBlog, title: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label>分类</label>
                <select
                  value={editingBlog.category_id || ""}
                  onChange={(e) =>
                    setEditingBlog({
                      ...editingBlog,
                      category_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="admin-input"
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>标签（逗号分隔）</label>
                <input
                  type="text"
                  value={editingBlog.tags || ""}
                  onChange={(e) => setEditingBlog({ ...editingBlog, tags: e.target.value })}
                  className="admin-input"
                  placeholder="AI, 工程, 创作"
                />
              </div>
              <div className="form-group">
                <label>内容</label>
                <textarea
                  value={editingBlog.content || ""}
                  onChange={(e) => setEditingBlog({ ...editingBlog, content: e.target.value })}
                  className="admin-input"
                  style={{ minHeight: "300px", fontFamily: "inherit" }}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="btn-admin btn-admin-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editLoading}
                >
                  取消
                </button>
                <button className="btn-admin btn-admin-primary" onClick={() => void handleSaveEdit()} disabled={editLoading}>
                  {editLoading ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
