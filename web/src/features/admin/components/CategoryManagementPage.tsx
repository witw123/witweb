/**
 * CategoryManagementPage - 分类管理页面组件
 *
 * 提供后台分类管理功能，包括：
 * - 创建新分类
 * - 编辑分类名称、别名、描述
 * - 启用/停用分类
 * - 删除分类
 * - 分类排序（上移/下移）
 *
 * @component
 * @example
 * <CategoryManagementPage />
 */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers";
import { getPaginated, post, put } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
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
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("info");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

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

  const categoriesQuery = useQuery({
    queryKey: queryKeys.adminCategories,
    enabled: isAuthenticated,
    queryFn: () => getPaginated<Category>("/api/admin/categories", { limit: 100 }),
  });

  const refreshCategories = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      post<{ id: number }>("/api/admin/categories", {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
      }),
    onSuccess: async () => {
      setName("");
      setSlug("");
      setDescription("");
      showSuccess("创建成功");
      await refreshCategories();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "创建失败");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (item: Category) =>
      put<{ updated: true }>(`/api/admin/categories/${item.id}`, {
        is_active: item.is_active ? 0 : 1,
      }),
    onSuccess: async () => {
      showSuccess("状态更新成功");
      await refreshCategories();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "更新失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: Category) => {
      const response = await fetch(`/api/admin/categories/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(payload.error?.message || "删除失败");
      }
    },
    onSuccess: async () => {
      setPendingDeleteId(null);
      showSuccess("删除成功");
      await refreshCategories();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "删除失败");
    },
  });

  const editMutation = useMutation({
    mutationFn: (category: Category) =>
      put<{ updated: true }>(`/api/admin/categories/${category.id}`, {
        name: category.name.trim(),
        slug: category.slug.trim(),
        description: (category.description || "").trim(),
      }),
    onSuccess: async () => {
      setEditingCategory(null);
      showSuccess("更新成功");
      await refreshCategories();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "更新失败");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) =>
      post<{ reordered: true }>("/api/admin/categories/reorder", { ids }),
    onSuccess: async () => {
      showSuccess("排序已更新");
      await refreshCategories();
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : "排序失败");
    },
  });

  const categories = useMemo(
    () => categoriesQuery.data?.items || [],
    [categoriesQuery.data?.items]
  );
  const loading = categoriesQuery.isLoading;

  const createCategory = async () => {
    if (!name.trim()) {
      showError("分类名称不能为空");
      return;
    }

    clearNotice();
    await createMutation.mutateAsync();
  };

  const submitEditCategory = async () => {
    if (!editingCategory) return;
    if (!editingCategory.name.trim()) {
      showError("分类名称不能为空");
      return;
    }
    if (!editingCategory.slug.trim()) {
      showError("分类别名不能为空");
      return;
    }

    await editMutation.mutateAsync(editingCategory);
  };

  const move = async (item: Category, direction: -1 | 1) => {
    const index = categories.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;

    const reordered = categories.slice();
    const [current] = reordered.splice(index, 1);
    reordered.splice(target, 0, current);

    queryClient.setQueryData(
      queryKeys.adminCategories,
      categoriesQuery.data ? { ...categoriesQuery.data, items: reordered } : categoriesQuery.data
    );

    try {
      await reorderMutation.mutateAsync(reordered.map((entry) => entry.id));
    } catch {
      await refreshCategories();
    }
  };

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
          <button className="btn-admin btn-admin-primary" type="button" onClick={() => void createCategory()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "创建中..." : "创建"}
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
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => void toggleMutation.mutateAsync(item)}>
                        {item.is_active ? "停用" : "启用"}
                      </button>
                      <button className="btn-admin btn-admin-secondary" type="button" onClick={() => setEditingCategory(item)}>
                        编辑
                      </button>

                      {pendingDeleteId === item.id ? (
                        <>
                          <button className="btn-admin btn-admin-danger" type="button" onClick={() => void deleteMutation.mutateAsync(item)}>
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
                <button className="btn-admin btn-admin-secondary" onClick={() => setEditingCategory(null)} disabled={editMutation.isPending}>
                  取消
                </button>
                <button className="btn-admin btn-admin-primary" onClick={() => void submitEditCategory()} disabled={editMutation.isPending}>
                  {editMutation.isPending ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
