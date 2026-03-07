import { headers } from "next/headers";
import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";
import { validateBody, z } from "@/lib/validate";

const trackVisitSchema = z.object({
  visitorId: z.string().min(1, "Visitor ID 不能为空"),
  pageUrl: z.string().default("/"),
});

export async function buildTrackVisitResponse(request: Request): Promise<Response> {
  const { visitorId, pageUrl } = await validateBody(request, trackVisitSchema);

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

  await postRepository.recordSiteVisit(visitorId, pageUrl || "/", userAgent, ipAddress);

  return successResponse({ recorded: true });
}
