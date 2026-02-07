"use client";

import { useParams } from "next/navigation";
import ProfilePage from "@/features/user/components/ProfilePage";

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  return (
    <div className="app-page-shell">
      <div className="app-page-container">
        <ProfilePage targetUsername={username} />
      </div>
    </div>
  );
}
