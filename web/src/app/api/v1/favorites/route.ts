import { withErrorHandler } from "@/middleware/error-handler";
import { buildFavoritesGetResponse } from "../../favorites/shared";

export const GET = withErrorHandler(async (req: Request) => buildFavoritesGetResponse(req));
