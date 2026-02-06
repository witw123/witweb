/**
 */

import { getBlogDb } from "@/lib/db";
import { headers } from "next/headers";
import { withErrorHandler } from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

// 璇锋眰浣撻獙璇?Schema
const trackVisitSchema = z.object({
  visitorId: z.string().min(1, "Visitor ID 涓嶈兘涓虹┖"),
  pageUrl: z.string().default("/"),
});

export const POST = withErrorHandler(async (request: Request) => {
  const db = getBlogDb();
  
  // 楠岃瘉璇锋眰浣?
  const { visitorId, pageUrl } = await validateBody(request, trackVisitSchema);

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

  // Record the visit
  db.prepare(`
    INSERT INTO site_visits (visitor_id, page_url, user_agent, ip_address)
    VALUES (?, ?, ?, ?)
  `).run(visitorId, pageUrl, userAgent, ipAddress);

  // Update or create unique visitor record
  const existingVisitor = db.prepare(`
    SELECT visitor_id FROM unique_visitors WHERE visitor_id = ?
  `).get(visitorId);

  if (existingVisitor) {
    db.prepare(`
      UPDATE unique_visitors 
      SET last_visit = CURRENT_TIMESTAMP, visit_count = visit_count + 1
      WHERE visitor_id = ?
    `).run(visitorId);
  } else {
    db.prepare(`
      INSERT INTO unique_visitors (visitor_id)
      VALUES (?)
    `).run(visitorId);
  }

  return successResponse({ recorded: true });
});
