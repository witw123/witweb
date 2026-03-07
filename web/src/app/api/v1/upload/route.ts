import { handleUploadPost } from "@/app/api/upload/shared";
import { withErrorHandler } from "@/middleware/error-handler";

export const POST = withErrorHandler(async (req) => handleUploadPost(req));
