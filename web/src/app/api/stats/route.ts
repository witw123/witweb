import { NextResponse } from "next/server";
import { getBlogDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getBlogDb();

    // Get total posts count
    const postsResult = db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number };
    const totalPosts = postsResult.count;

    // Get total visits count
    let totalVisits = 0;
    try {
      const visitsResult = db.prepare("SELECT COUNT(*) as count FROM site_visits").get() as { count: number };
      totalVisits = visitsResult.count;
    } catch (e) {
      // Table might not exist yet, use 0
      totalVisits = 0;
    }

    // Get unique visitors count
    let totalVisitors = 0;
    try {
      const visitorsResult = db.prepare("SELECT COUNT(*) as count FROM unique_visitors").get() as { count: number };
      totalVisitors = visitorsResult.count;
    } catch (e) {
      // Table might not exist yet, use 0
      totalVisitors = 0;
    }

    return NextResponse.json({
      totalPosts,
      totalVisits,
      totalVisitors,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { totalPosts: 0, totalVisits: 0, totalVisitors: 0 },
      { status: 500 }
    );
  }
}
