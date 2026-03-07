import { withErrorHandler } from "@/middleware/error-handler";
import { buildUnreadResponse } from "../../../messages/unread/shared";

export const GET = withErrorHandler(async () => buildUnreadResponse());
