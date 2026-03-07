import { userRepository } from "@/lib/repositories";
import { getAuthUser } from "@/lib/http";
import { errorResponses, successResponse } from "@/lib/api-response";

export async function buildReadNotificationsResponse(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) {
    return errorResponses.unauthorized("请先登录");
  }

  await userRepository.markNotificationsAsRead(user);

  return successResponse({ ok: true });
}
