import { Suspense } from "react";
import ProfilePage from "@/features/user/components/ProfilePage";

export default function ProfileRoute() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfilePage />
    </Suspense>
  );
}

