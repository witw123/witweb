"use client";

import { useEffect, useState } from "react";

export default function BlogManagementPage() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadBlogs();
  }, [page, search, statusFilter]);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });

      const response = await fetch(`/api/admin/blogs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBlogs(data.blogs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to load blogs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blogId: number, title: string) => {
    if (!confirm(`确定要删除文章《${title}》吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("文章删除成功");
        loadBlogs();
      } else {
        alert("删除失败");
      }
    } catch (error: any) {
      alert(`删除失败: ${error.message}`);
    }
  };

  const handleStatusChange = async (blogId: number, newStatus: string) => {
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
        alert("状态更新成功");
        loadBlogs();
      } else {
        alert("更新失败");
      }
    } catch (error: any) {
      alert(`更新失败: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">文章管理</h1>
        <p className="page-subtitle">管理所有用户文章</p>
      </div>

      <div className="admin-card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <input
            type="text"
            placeholder="搜索文章..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input"
            style={{ width: "300px" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
          <div style={{ marginLeft: "auto" }}>共 {total} 篇文章</div>
        </div>

        {loading ? (
          ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>作者</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog.id}>
                  <td><strong>{blog.title}</strong></td>
                  <td>{blog.username}</td>
                  <td>
                    <span className={`badge badge-${blog.status === "published" ? "success" : "warning"}`}>
                      {blog.status === "published" ? "已发布" : "草稿"}
                    </span>
                  </td>
                  <td>{new Date(blog.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {blog.status === "draft" && (
                        <button
                          onClick={() => handleStatusChange(blog.id, "published")}
                          className="btn-admin btn-admin-primary"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          发布
                        </button>
                      )}
                      {blog.status === "published" && (
                        <button
                          onClick={() => handleStatusChange(blog.id, "draft")}
                          className="btn-admin btn-admin-secondary"
                          style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                        >
                          撤回
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(blog.id, blog.title)}
                        className="btn-admin btn-admin-danger"
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        删除
                      </button>
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
    </div>
  );
}

