import { Suspense } from "react";
import ProfilePage from "@/components/legacy/ProfilePage";

export default function ProfileRoute() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfilePage />
    </Suspense>
  );
}
