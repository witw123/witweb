import { successResponse } from "@/lib/api-response";
import { clearAuthCookie } from "@/lib/auth-cookie";

export async function handleLogoutPost() {
  return clearAuthCookie(successResponse({ ok: true }));
}
