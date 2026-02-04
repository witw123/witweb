import AdminLayout from "@/components/legacy/admin/AdminLayout";
import FriendLinksManagement from "@/components/legacy/admin/FriendLinksManagement";

export default function AdminFriendsPage() {
  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">友链管理</h1>
        <p className="page-subtitle">管理友情链接</p>
      </div>
      <FriendLinksManagement />
    </AdminLayout>
  );
}
