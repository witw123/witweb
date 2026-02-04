"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(Array.isArray(data?.items) ? data.items : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1 className="text-2xl font-bold mb-2">文章分类</h1>
        <p className="text-muted text-sm">按分类快速浏览内容，点击即可筛选相关文章。</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {!loading &&
          categories.map((item) => (
            <Link key={item.id} href={`/?category=${item.slug}`} className="card block no-underline text-inherit">
              <div className="text-lg font-semibold mb-2">{item.name}</div>
              <div className="text-sm text-muted mb-3">{item.description || "暂无描述"}</div>
              <div className="text-xs text-muted">{item.post_count || 0} 篇文章</div>
            </Link>
          ))}
      </div>
      {!loading && categories.length === 0 && <p className="text-muted mt-4">暂无分类</p>}
    </div>
  );
}

