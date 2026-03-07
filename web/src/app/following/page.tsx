import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";

const FollowingPageContent = dynamic(
  () => import("@/features/user/components/FollowingPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

export default function FollowingPage() {
  return (
    <RequireAuth>
      <FollowingPageContent />
    </RequireAuth>
  );
}
