import { Suspense } from "react";
import RequireAuth from "@/components/RequireAuth";
import FollowingPageContent from "@/features/user/components/FollowingPageContent";

export default function FollowingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="flex justify-center py-20 animate-pulse text-zinc-500">鍔犺浇涓?..</div>}>
        <FollowingPageContent />
      </Suspense>
    </RequireAuth>
  );
}

