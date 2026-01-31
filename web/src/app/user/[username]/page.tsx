"use client";

import { useParams } from "next/navigation";
import ProfilePage from "@/components/legacy/ProfilePage";

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  return (
    <div className="py-8">
      <ProfilePage targetUsername={username} />
    </div>
  );
}
