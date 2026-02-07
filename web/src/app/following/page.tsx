import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import FollowingPageContent from "@/features/user/components/FollowingPageContent";

export default function FollowingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="app-loading-fallback">加载中...</div>}>
        <FollowingPageContent />
      </Suspense>
    </RequireAuth>
  );
}
