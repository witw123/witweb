import { withErrorHandler } from "@/middleware/error-handler";
import { buildTagsResponse } from "../../tags/shared";

export const GET = withErrorHandler(async () => buildTagsResponse());
