"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNotice from "./AdminNotice";
import { ADMIN_LIST_PAGE_SIZE } from "@/features/admin/constants";

type BlogItem = {
  id: number;
  username: string;
  title: string;
  status: "published" | "draft" | "deleted";
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
  const [recycleMode, setRecycleMode] = useState(false);
  const [authorFilter, setAuthorFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("created_at_desc");
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchDeleteConfirming, setBatchDeleteConfirming] = useState(false);

  const [editingBlog, setEditingBlog] = useState<BlogDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDestroyId, setPendingDestroyId] = useState<number | null>(null);
  const showError = (msg: string) => {
    setNoticeTone("error");
    setMessage(msg);
  };
  const showSuccess = (msg: string) => {
    setNoticeTone("success");
    setMessage(msg);
  };

  const loadBlogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ADMIN_LIST_PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      if (recycleMode) {
        params.set("status", "deleted");
      } else if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (authorFilter.trim()) params.set("username", authorFilter.trim());
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59.999Z`);
      if (sort) params.set("sort", sort);

      const response = await fetch(`/api/admin/blogs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setBlogs([]);
        setTotal(0);
        showError(data.error?.message || "加载文章失败");
        return;
      }

      setBlogs(data.data?.items || []);
      setTotal(data.data?.total || 0);
      setSelectedIds((prev) => prev.filter((id) => (data.data?.items || []).some((item: BlogItem) => item.id === id)));
    } catch {
      setBlogs([]);
      setTotal(0);
      showError("加载文章失败");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, recycleMode, authorFilter, tagFilter, dateFrom, dateTo, sort]);

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
        showError(data.error?.message || "获取文章详情失败");
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
        showError(data.error?.message || "更新失败");
        return;
      }
      showSuccess("更新成功");
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
        showSuccess(`文章《${title}》已移入回收站`);
        setPendingDeleteId(null);
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      showError(data.error?.message || "删除失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      showError(`删除失败: ${message}`);
    }
  };

  const handleRestore = async (blogId: number, title: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "draft" }),
      });

      if (response.ok) {
        showSuccess(`文章《${title}》已恢复为草稿`);
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      showError(data.error?.message || "恢复失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      showError(`恢复失败: ${message}`);
    }
  };

  const handleDestroy = async (blogId: number, title: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/blogs/${blogId}?hard=1`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showSuccess(`文章《${title}》已永久删除`);
        setPendingDestroyId(null);
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      showError(data.error?.message || "永久删除失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      showError(`永久删除失败: ${message}`);
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
        showSuccess("状态更新成功");
        void loadBlogs();
        return;
      }

      const data = await response.json().catch(() => ({}));
      showError(data.error?.message || "更新失败");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "未知错误";
      showError(`更新失败: ${message}`);
    }
  };

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  };

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => prev.filter((id) => !blogs.some((blog) => blog.id === id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...blogs.map((blog) => blog.id)])));
  };

  const runBatchAction = async (action: "publish" | "draft" | "delete" | "restore" | "destroy") => {
    if (selectedIds.length === 0) {
      showError("请先选择至少一篇文章");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/admin/blogs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ids: selectedIds,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showError(data.error?.message || "批量操作失败");
        return;
      }

      if (action === "delete") showSuccess(`批量操作完成，共移入回收站 ${data.data?.deleted ?? 0} 篇文章`);
      if (action === "destroy") showSuccess(`批量永久删除完成，共删除 ${data.data?.deleted ?? 0} 篇文章`);
      if (action === "publish" || action === "draft" || action === "restore") showSuccess(`批量更新完成，共更新 ${data.data?.updated ?? 0} 篇文章`);
      setSelectedIds([]);
      setBatchDeleteConfirming(false);
      void loadBlogs();
    } catch (error: unknown) {
      showError(error instanceof Error ? error.message : "批量操作失败");
    }
  };

  const allCurrentPageSelected = blogs.length > 0 && blogs.every((blog) => selectedIds.includes(blog.id));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">文章管理</h1>
        <p className="page-subtitle">管理站内全部文章</p>
      </div>

      <div className="admin-card">
        <AdminNotice message={message} tone={noticeTone} />

        <div className="blog-toolbar">
          <div className="blog-toolbar-head">
            <div className="blog-toolbar-title">筛选条件</div>
            <div className="blog-toolbar-count">共 {total} 篇文章</div>
          </div>

          <div className="blog-filter-grid">
            <input
              type="text"
              placeholder="搜索标题/内容关键字"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="admin-input blog-filter-search"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="admin-select"
              disabled={recycleMode}
            >
              <option value="">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
              <option value="deleted">已删除</option>
            </select>
            <input
              type="text"
              placeholder="作者用户名"
              value={authorFilter}
              onChange={(e) => {
                setAuthorFilter(e.target.value);
                setPage(1);
              }}
              className="admin-input"
            />
            <input
              type="text"
              placeholder="标签关键字"
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setPage(1);
              }}
              className="admin-input"
            />
            <div className="blog-date-field">
              <div className="blog-date-label">开始日期</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="admin-input"
                aria-label="开始日期"
              />
            </div>
            <div className="blog-date-field">
              <div className="blog-date-label">结束日期</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="admin-input"
                aria-label="结束日期"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="admin-select"
            >
              <option value="created_at_desc">创建时间（新到旧）</option>
              <option value="created_at_asc">创建时间（旧到新）</option>
              <option value="updated_at_desc">更新时间（新到旧）</option>
              <option value="updated_at_asc">更新时间（旧到新）</option>
              <option value="title_asc">标题（A-Z）</option>
              <option value="title_desc">标题（Z-A）</option>
            </select>
          </div>

          <div className="blog-toolbar-actions">
            <div className="blog-toolbar-left">
              <button
                className="btn-admin btn-admin-secondary"
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(recycleMode ? "deleted" : "");
                  setAuthorFilter("");
                  setTagFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setSort("created_at_desc");
                  setPage(1);
                }}
              >
                清空筛选
              </button>
            </div>
            <div className="blog-toolbar-right">
              <button
                className={`btn-admin ${recycleMode ? "btn-admin-secondary" : "btn-admin-primary"}`}
                type="button"
                onClick={() => {
                  setRecycleMode(false);
                  setStatusFilter("");
                  setPage(1);
                  setSelectedIds([]);
                  setBatchDeleteConfirming(false);
                }}
              >
                正常列表
              </button>
              <button
                className={`btn-admin ${recycleMode ? "btn-admin-primary" : "btn-admin-secondary"}`}
                type="button"
                onClick={() => {
                  setRecycleMode(true);
                  setStatusFilter("deleted");
                  setPage(1);
                  setSelectedIds([]);
                  setBatchDeleteConfirming(false);
                }}
              >
                回收站
              </button>
            </div>
          </div>
        </div>

        <div className="blog-batch-bar">
          <span className="blog-batch-count">已选 {selectedIds.length} 篇</span>
          {!recycleMode && (
            <>
              <button
                className="btn-admin btn-admin-secondary"
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  setBatchDeleteConfirming(false);
                  void runBatchAction("publish");
                }}
              >
                批量发布
              </button>
              <button
                className="btn-admin btn-admin-secondary"
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  setBatchDeleteConfirming(false);
                  void runBatchAction("draft");
                }}
              >
                批量撤回
              </button>
            </>
          )}
          {recycleMode && (
            <button
              className="btn-admin btn-admin-secondary"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => {
                setBatchDeleteConfirming(false);
                void runBatchAction("restore");
              }}
            >
              批量恢复为草稿
            </button>
          )}
          {!batchDeleteConfirming ? (
            <button
              className="btn-admin btn-admin-danger"
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setBatchDeleteConfirming(true)}
            >
              {recycleMode ? "批量永久删除" : "批量删除"}
            </button>
          ) : (
            <>
              <button
                className="btn-admin btn-admin-danger"
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => void runBatchAction(recycleMode ? "destroy" : "delete")}
              >
                {recycleMode ? "确认批量永久删除" : "确认批量删除"}
              </button>
              <button
                className="btn-admin btn-admin-secondary"
                type="button"
                onClick={() => setBatchDeleteConfirming(false)}
              >
                取消
              </button>
            </>
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
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(blog.id)}
                      onChange={(e) => toggleSelect(blog.id, e.target.checked)}
                    />
                  </td>
                  <td>
                    <strong>{blog.title}</strong>
                  </td>
                  <td>{blog.username}</td>
                  <td>{blog.category_name || "未分类"}</td>
                  <td>
                    <span
                      className={`badge badge-${
                        blog.status === "published" ? "success" : blog.status === "deleted" ? "danger" : "warning"
                      }`}
                    >
                      {blog.status === "published" ? "已发布" : blog.status === "deleted" ? "已删除" : "草稿"}
                    </span>
                  </td>
                  <td>{new Date(blog.created_at).toLocaleString("zh-CN")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {!recycleMode && (
                        <>
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
                        </>
                      )}
                      {recycleMode &&
                        (pendingDestroyId === blog.id ? (
                          <>
                            <button
                              onClick={() => void handleRestore(blog.id, blog.title)}
                              className="btn-admin btn-admin-secondary"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              恢复为草稿
                            </button>
                            <button
                              onClick={() => void handleDestroy(blog.id, blog.title)}
                              className="btn-admin btn-admin-danger"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              确认永久删除
                            </button>
                            <button
                              onClick={() => setPendingDestroyId(null)}
                              className="btn-admin btn-admin-secondary"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => void handleRestore(blog.id, blog.title)}
                              className="btn-admin btn-admin-secondary"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              恢复
                            </button>
                            <button
                              onClick={() => setPendingDestroyId(blog.id)}
                              className="btn-admin btn-admin-danger"
                              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                            >
                              永久删除
                            </button>
                          </>
                        ))}
                    </div>
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
