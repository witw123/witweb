"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SuccessResponse } from "@/lib/api-response";
import { getVersionedApiPath } from "@/lib/api-version";
import type { Category } from "@/types/blog";

type CategoryWithCount = Category & { post_count?: number };

function readSuccessData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as Partial<SuccessResponse<T>>;
  if (parsed.success !== true) return null;
  return parsed.data ?? null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getVersionedApiPath("/categories"))
      .then((res) => res.json())
      .then((response) => {
        const data = readSuccessData<{ items: CategoryWithCount[] }>(response);
        setCategories(Array.isArray(data?.items) ? data.items : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container blog-page-shell categories-page">
      <div className="card blog-page-card">
        <h1 className="blog-page-title">文章分类</h1>
        <p className="blog-page-subtitle">按分类快速浏览内容，点击即可筛选相关文章。</p>
      </div>

      <div className="blog-categories-grid mt-4">
        {!loading &&
          categories.map((item) => (
            <Link key={item.id} href={`/?category=${item.slug}#posts-anchor`} className="blog-category-card">
              <div className="blog-category-name">{item.name}</div>
              <div className="blog-category-desc">{item.description || "暂无描述"}</div>
              <div className="blog-category-count">{item.post_count || 0} 篇文章</div>
            </Link>
          ))}
      </div>

      {!loading && categories.length === 0 && <p className="mt-4 text-muted">暂无分类</p>}
    </div>
  );
}
