import { headers } from "next/headers";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import { postRepository } from "@/lib/repositories";

const trackVisitSchema = z.object({
  visitorId: z.string().min(1, "Visitor ID 不能为空"),
  pageUrl: z.string().default("/"),
});

export const POST = withErrorHandler(async (request: Request) => {
  const { visitorId, pageUrl } = await validateBody(request, trackVisitSchema);

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

  await postRepository.recordSiteVisit(visitorId, pageUrl || "/", userAgent, ipAddress);

  return successResponse({ recorded: true });
});
