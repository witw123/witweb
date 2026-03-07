/**
 * @deprecated Use /api/v1/upload/image instead
 */

import { annotateDeprecatedResponse } from "@/lib/api-version";
import { withErrorHandler } from "@/middleware/error-handler";
import { handleUploadPost } from "./shared";

export const POST = withErrorHandler(async (req) =>
  annotateDeprecatedResponse(await handleUploadPost(req), "/api/v1/upload/image", "/api/upload")
);
