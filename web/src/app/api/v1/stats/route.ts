import { withErrorHandler } from "@/middleware/error-handler";
import { buildSiteStatsResponse } from "../../stats/shared";

export const GET = withErrorHandler(async () => buildSiteStatsResponse());
