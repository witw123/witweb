/**
 * @deprecated Use /api/v1/favorites instead
 */

import { NextRequest } from "next/server";
import { annotateDeprecatedResponse } from "@/lib/api-version";
import { withErrorHandler } from "@/middleware/error-handler";
import { buildFavoritesGetResponse } from "./shared";

export const GET = withErrorHandler(async (req: NextRequest) => {
  return annotateDeprecatedResponse(await buildFavoritesGetResponse(req), "/api/v1/favorites", "/api/favorites");
});
