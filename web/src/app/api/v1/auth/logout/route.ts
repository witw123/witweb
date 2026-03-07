import { handleLogoutPost } from "@/app/api/logout/shared";

export async function POST() {
  return handleLogoutPost();
}
