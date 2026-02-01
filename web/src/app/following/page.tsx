import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import FollowingPageContent from "@/components/legacy/FollowingPageContent";

export default function FollowingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="flex justify-center py-20 animate-pulse text-zinc-500">加载中...</div>}>
        <FollowingPageContent />
      </Suspense>
    </RequireAuth>
  );
}
