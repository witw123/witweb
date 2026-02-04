"use client";

import { Suspense } from "react";
import BlogListPage from "@/features/blog/components/BlogListPage";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <BlogListPage />
    </Suspense>
  );
}
