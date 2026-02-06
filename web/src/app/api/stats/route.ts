/**
 */

import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { getBlogDb } from "@/lib/db";

export const GET = withErrorHandler(async () => {
  const db = getBlogDb();

  // Get total posts count
  const postsResult = db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number };
  const totalPosts = postsResult.count;

  // Get total visits count
  let totalVisits = 0;
  try {
    const visitsResult = db.prepare("SELECT COUNT(*) as count FROM site_visits").get() as { count: number };
    totalVisits = visitsResult.count;
  } catch {
    // Table might not exist yet, use 0
    totalVisits = 0;
  }

  // Get unique visitors count
  let totalVisitors = 0;
  try {
    const visitorsResult = db.prepare("SELECT COUNT(*) as count FROM unique_visitors").get() as { count: number };
    totalVisitors = visitorsResult.count;
  } catch {
    // Table might not exist yet, use 0
    totalVisitors = 0;
  }

  return successResponse({
    totalPosts,
    totalVisits,
    totalVisitors,
  });
});
