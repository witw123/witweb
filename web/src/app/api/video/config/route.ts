import { withErrorHandler } from "@/middleware/error-handler";
import { getVideoConfigHandler, updateVideoConfigHandler } from "./shared";

export const GET = withErrorHandler(async () => getVideoConfigHandler());
export const POST = withErrorHandler(async (req) => updateVideoConfigHandler(req));
