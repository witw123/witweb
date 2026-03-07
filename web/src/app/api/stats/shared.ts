import { successResponse } from "@/lib/api-response";
import { postRepository } from "@/lib/repositories";

export async function buildSiteStatsResponse(): Promise<Response> {
  const { totalPosts, totalVisits, totalVisitors } = await postRepository.getSiteStats();

  return successResponse({
    totalPosts,
    totalVisits,
    totalVisitors,
  });
}
