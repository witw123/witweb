/**
 * BlogManagementPage - 文章管理页面组件
 *
 * 提供后台文章管理功能，包括：
 * - 文章列表展示和筛选（按状态、作者、标签、日期）
 * - 文章编辑、删除、恢复、永久删除
 * - 批量操作（批量发布、批量删除等）
 * - 回收站模式
 *
 * @component
 * @example
 * <BlogManagementPage />
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { del, get, post, put } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ADMIN_LIST_PAGE_SIZE } from "@/features/admin/constants";
import AdminNotice from "./AdminNotice";

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

type BlogListResponse = {
  items: BlogItem[];
  total: number;
  page: number;
  size: number;
};

type AdminCategoriesResponse = {
  items: Category[];
  total: number;
  page: number;
  size: number;
};

type BatchAction = "publish" | "draft" | "delete" | "restore" | "destroy";

export default function BlogManagementPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
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
  const [selectedIdsState, setSelectedIds] = useState<number[]>([]);
  const [batchDeleteConfirming, setBatchDeleteConfirming] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDestroyId, setPendingDestroyId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      page,
      limit: ADMIN_LIST_PAGE_SIZE,
      search: search.trim(),
      status: recycleMode ? "deleted" : statusFilter,
      username: authorFilter.trim(),
      tag: tagFilter.trim(),
      dateFrom,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : "",
      sort,
    }),
    [page, search, recycleMode, statusFilter, authorFilter, tagFilter, dateFrom, dateTo, sort],
  );

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

  const blogsQuery = useQuery({
    queryKey: queryKeys.adminBlogs(filters),
    enabled: isAuthenticated,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.username) params.set("username", filters.username);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters.dateTo) params.set("date_to", filters.dateTo);
      if (filters.sort) params.set("sort", filters.sort);
      return get<BlogListResponse>(`/api/admin/blogs?${params.toString()}`);
    },
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.adminCategories,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      return get<AdminCategoriesResponse>(`/api/admin/categories?limit=100`);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminBlogs(filters) });
    };
    window.addEventListener("profile-updated", handler as EventListener);
    return () => window.removeEventListener("profile-updated", handler as EventListener);
  }, [filters, queryClient]);

  const editMutation = useMutation({
    mutationFn: async (blogId: number) => {
      return get<BlogDetail>(`/api/admin/blogs/${blogId}`);
    },
    onSuccess: (data) => {
      setEditingBlog(data);
      setIsEditModalOpen(true);
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "获取文章详情失败");
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async (blog: BlogDetail) => {
      return put<{ ok: true }>(`/api/admin/blogs/${blog.id}`, {
        title: blog.title,
        content: blog.content,
        tags: blog.tags,
        category_id: blog.category_id || null,
      });
    },
    onSuccess: async () => {
      showSuccess("更新成功");
      setIsEditModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminBlogs(filters) });
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "更新失败");
    },
  });

  const rowActionMutation = useMutation({
    mutationFn: async (input: { type: "delete" | "destroy" | "restore" | "status"; blogId: number; status?: "published" | "draft" }) => {
      if (input.type === "delete") {
        return del<{ ok: true }>(`/api/admin/blogs/${input.blogId}`);
      }
      if (input.type === "destroy") {
        return del<{ ok: true }>(`/api/admin/blogs/${input.blogId}?hard=1`);
      }
      if (input.type === "restore") {
        return put<{ ok: true }>(`/api/admin/blogs/${input.blogId}`, { status: "draft" });
      }
      return put<{ ok: true }>(`/api/admin/blogs/${input.blogId}`, { status: input.status });
    },
    onSuccess: async () => {
      setPendingDeleteId(null);
      setPendingDestroyId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminBlogs(filters) });
    },
  });

  const batchActionMutation = useMutation({
    mutationFn: async (payload: { action: BatchAction; ids: number[] }) => {
      return post<{ ok: true; updated?: number; deleted?: number }>(
        "/api/admin/blogs",
        payload,
      );
    },
    onSuccess: async () => {
      setSelectedIds([]);
      setBatchDeleteConfirming(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminBlogs(filters) });
    },
  });

  const blogs = useMemo(() => blogsQuery.data?.items || [], [blogsQuery.data?.items]);
  const selectedIds = useMemo(
    () => selectedIdsState.filter((id) => blogs.some((blog) => blog.id === id)),
    [blogs, selectedIdsState]
  );
  const total = blogsQuery.data?.total || 0;
  const categories = categoriesQuery.data?.items || [];
  const loading = blogsQuery.isLoading;

  const handleDelete = async (blogId: number, title: string) => {
    try {
      await rowActionMutation.mutateAsync({ type: "delete", blogId });
      showSuccess(`文章《${title}》已移入回收站`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleRestore = async (blogId: number, title: string) => {
    try {
      await rowActionMutation.mutateAsync({ type: "restore", blogId });
      showSuccess(`文章《${title}》已恢复为草稿`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "恢复失败");
    }
  };

  const handleDestroy = async (blogId: number, title: string) => {
    try {
      await rowActionMutation.mutateAsync({ type: "destroy", blogId });
      showSuccess(`文章《${title}》已永久删除`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "永久删除失败");
    }
  };

  const handleStatusChange = async (blogId: number, newStatus: "published" | "draft") => {
    try {
      await rowActionMutation.mutateAsync({ type: "status", blogId, status: newStatus });
      showSuccess("状态更新成功");
    } catch (error) {
      showError(error instanceof Error ? error.message : "更新失败");
    }
  };

  const runBatchAction = async (action: BatchAction) => {
    if (selectedIds.length === 0) {
      showError("请先选择至少一篇文章");
      return;
    }

    try {
      const data = await batchActionMutation.mutateAsync({ action, ids: selectedIds });
      if (action === "delete") showSuccess(`批量操作完成，共移入回收站 ${data.deleted ?? 0} 篇文章`);
      if (action === "destroy") showSuccess(`批量永久删除完成，共删除 ${data.deleted ?? 0} 篇文章`);
      if (action === "publish" || action === "draft" || action === "restore") {
        showSuccess(`批量更新完成，共更新 ${data.updated ?? 0} 篇文章`);
      }
    } catch (error) {
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
                  clearNotice();
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
              <button className="btn-admin btn-admin-secondary" type="button" disabled={selectedIds.length === 0} onClick={() => void runBatchAction("publish")}>
                批量发布
              </button>
              <button className="btn-admin btn-admin-secondary" type="button" disabled={selectedIds.length === 0} onClick={() => void runBatchAction("draft")}>
                批量撤回
              </button>
            </>
          )}
          {recycleMode && (
            <button className="btn-admin btn-admin-secondary" type="button" disabled={selectedIds.length === 0} onClick={() => void runBatchAction("restore")}>
              批量恢复为草稿
            </button>
          )}
          {!batchDeleteConfirming ? (
            <button className="btn-admin btn-admin-danger" type="button" disabled={selectedIds.length === 0} onClick={() => setBatchDeleteConfirming(true)}>
              {recycleMode ? "批量永久删除" : "批量删除"}
            </button>
          ) : (
            <>
              <button className="btn-admin btn-admin-danger" type="button" disabled={selectedIds.length === 0} onClick={() => void runBatchAction(recycleMode ? "destroy" : "delete")}>
                {recycleMode ? "确认批量永久删除" : "确认批量删除"}
              </button>
              <button className="btn-admin btn-admin-secondary" type="button" onClick={() => setBatchDeleteConfirming(false)}>
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
                  <input type="checkbox" checked={allCurrentPageSelected} onChange={(e) => {
                    if (!e.target.checked) {
                      setSelectedIds((prev) => prev.filter((id) => !blogs.some((blog) => blog.id === id)));
                      return;
                    }
                    setSelectedIds((prev) => Array.from(new Set([...prev, ...blogs.map((blog) => blog.id)])));
                  }} />
                </th>
                <th>标题</th>
                <th>作者</th>
                <th>分类</th>
                <th>状态</th>
                <th>创建时间</th>
                <th className="blog-col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(blog.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? Array.from(new Set([...prev, blog.id])) : prev.filter((item) => item !== blog.id),
                        )
                      }
                    />
                  </td>
                  <td><strong>{blog.title}</strong></td>
                  <td>{blog.username}</td>
                  <td>{blog.category_name || "未分类"}</td>
                  <td>
                    <span className={`badge badge-${blog.status === "published" ? "success" : blog.status === "deleted" ? "danger" : "warning"}`}>
                      {blog.status === "published" ? "已发布" : blog.status === "deleted" ? "已删除" : "草稿"}
                    </span>
                  </td>
                  <td>{new Date(blog.created_at).toLocaleString("zh-CN")}</td>
                  <td className="blog-actions-cell">
                    <div className="blog-row-actions">
                      {!recycleMode && (
                        <>
                          <button onClick={() => void editMutation.mutateAsync(blog.id)} className="btn-admin btn-admin-primary blog-row-action-btn">
                            编辑
                          </button>
                          {blog.status === "draft" && (
                            <button onClick={() => void handleStatusChange(blog.id, "published")} className="btn-admin btn-admin-secondary blog-row-action-btn">
                              发布
                            </button>
                          )}
                          {blog.status === "published" && (
                            <button onClick={() => void handleStatusChange(blog.id, "draft")} className="btn-admin btn-admin-secondary blog-row-action-btn">
                              撤回
                            </button>
                          )}
                          {pendingDeleteId === blog.id ? (
                            <>
                              <button onClick={() => void handleDelete(blog.id, blog.title)} className="btn-admin btn-admin-danger blog-row-action-btn">确认删除</button>
                              <button onClick={() => setPendingDeleteId(null)} className="btn-admin btn-admin-secondary blog-row-action-btn">取消</button>
                            </>
                          ) : (
                            <button onClick={() => setPendingDeleteId(blog.id)} className="btn-admin btn-admin-danger blog-row-action-btn">删除</button>
                          )}
                        </>
                      )}
                      {recycleMode &&
                        (pendingDestroyId === blog.id ? (
                          <>
                            <button onClick={() => void handleRestore(blog.id, blog.title)} className="btn-admin btn-admin-secondary blog-row-action-btn">恢复为草稿</button>
                            <button onClick={() => void handleDestroy(blog.id, blog.title)} className="btn-admin btn-admin-danger blog-row-action-btn">确认永久删除</button>
                            <button onClick={() => setPendingDestroyId(null)} className="btn-admin btn-admin-secondary blog-row-action-btn">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => void handleRestore(blog.id, blog.title)} className="btn-admin btn-admin-secondary blog-row-action-btn">恢复</button>
                            <button onClick={() => setPendingDestroyId(blog.id)} className="btn-admin btn-admin-danger blog-row-action-btn">永久删除</button>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-admin btn-admin-secondary">
              上一页
            </button>
            <span style={{ padding: "0.5rem 1rem" }}>第 {page} 页</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * ADMIN_LIST_PAGE_SIZE >= total} className="btn-admin btn-admin-secondary">
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
                  onChange={(e) => setEditingBlog({ ...editingBlog, category_id: e.target.value ? Number(e.target.value) : null })}
                  className="admin-input"
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
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
                <button className="btn-admin btn-admin-secondary" onClick={() => setIsEditModalOpen(false)} disabled={saveEditMutation.isPending}>
                  取消
                </button>
                <button className="btn-admin btn-admin-primary" onClick={() => editingBlog && void saveEditMutation.mutateAsync(editingBlog)} disabled={saveEditMutation.isPending}>
                  {saveEditMutation.isPending ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
