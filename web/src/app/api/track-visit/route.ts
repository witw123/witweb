import { NextResponse } from "next/server";
import { getBlogDb } from "@/lib/db";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    const db = getBlogDb();
    const { visitorId, pageUrl } = await request.json();

    if (!visitorId) {
      return NextResponse.json({ error: "Visitor ID required" }, { status: 400 });
    }

    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

    // Record the visit
    db.prepare(`
      INSERT INTO site_visits (visitor_id, page_url, user_agent, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(visitorId, pageUrl || "/", userAgent, ipAddress);

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking visit:", error);
    return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
  }
}
