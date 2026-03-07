import { NextRequest } from "next/server";
import { withErrorHandler } from "@/middleware/error-handler";
import { buildNotificationsResponse } from "../../../messages/notifications/shared";

export const GET = withErrorHandler(async (req: NextRequest) => buildNotificationsResponse(req));
