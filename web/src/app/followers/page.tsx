import dynamic from "next/dynamic";
import RequireAuth from "@/components/RequireAuth";

const FollowersPageContent = dynamic(
  () => import("@/features/user/components/FollowersPageContent"),
  { loading: () => <div className="app-loading-fallback">加载中...</div> }
);

export default function FollowersPage() {
  return (
    <RequireAuth>
      <FollowersPageContent />
    </RequireAuth>
  );
}
