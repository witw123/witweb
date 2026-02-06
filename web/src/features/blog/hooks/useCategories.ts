"use client";

import { useState, useEffect } from "react";
import type { Category } from "@/types/blog";
import { getCachedJson, setCachedJson } from "@/utils/cache";

const CACHE_KEY = "cache:categories";
const CACHE_TTL = 5 * 60 * 1000;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const cached = getCachedJson<Category[]>(CACHE_KEY, CACHE_TTL);
      if (cached) {
        setCategories(cached);
        setStatus("success");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        const res = await fetch("/api/categories");
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload?.success === false) {
          throw new Error(payload?.error?.message || "获取分类失败");
        }
        const items = Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        
        setCategories(items);
        setStatus("success");
        setCachedJson(CACHE_KEY, items);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "获取分类失败");
      }
    };

    fetchCategories();
  }, []);

  return {
    categories,
    status,
    error,
  };
}

