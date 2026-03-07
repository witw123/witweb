import { withErrorHandler } from "@/middleware/error-handler";
import { validateQuery, z } from "@/lib/validate";
import {
  getAdminStatsOverviewHandler,
  getAdminStatsTrendsHandler,
} from "./shared";

const statsQuerySchema = z.object({
  view: z.enum(["overview", "trends"]).default("overview"),
});

export const GET = withErrorHandler(async (req: Request) => {
  const { view } = await validateQuery(req, statsQuerySchema);

  if (view === "trends") {
    return getAdminStatsTrendsHandler(req);
  }

  return getAdminStatsOverviewHandler();
});
