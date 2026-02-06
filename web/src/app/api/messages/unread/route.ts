/**
 */

import { getUnreadTotal } from "@/lib/messages";
import { getUnreadNotificationCount } from "@/lib/blog";
import { getAuthUser } from "@/lib/http";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";

export const GET = withErrorHandler(async () => {
  const user = await getAuthUser();
  if (!user) {
    return successResponse({ unread_count: 0 });
  }

  try {
    const msgTotal = getUnreadTotal(user);
    const notifTotal = getUnreadNotificationCount(user);
    return successResponse({ unread_count: msgTotal + notifTotal });
  } catch {
    return successResponse({ unread_count: 0 });
  }
});
