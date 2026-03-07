import { withDeprecation } from "@/lib/deprecation";
import { handleLogoutPost } from "@/app/api/logout/shared";

export async function POST() {
  return withDeprecation(await handleLogoutPost(), "/api/v1/auth/logout");
}
