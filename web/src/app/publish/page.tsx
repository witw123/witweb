import { Suspense } from "react";
import PublishPage from "@/features/blog/components/PublishPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="container py-12 text-center text-zinc-400">加载中...</div>}>
      <PublishPage />
    </Suspense>
  );
}
