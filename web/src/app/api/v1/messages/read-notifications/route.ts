import { withErrorHandler } from "@/middleware/error-handler";
import { buildReadNotificationsResponse } from "../../../messages/read-notifications/shared";

export const POST = withErrorHandler(async () => buildReadNotificationsResponse());
