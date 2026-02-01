import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import FollowersPageContent from "@/components/legacy/FollowersPageContent";

export default function FollowersPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="flex justify-center py-20 animate-pulse text-zinc-500">加载中...</div>}>
        <FollowersPageContent />
      </Suspense>
    </RequireAuth>
  );
}
