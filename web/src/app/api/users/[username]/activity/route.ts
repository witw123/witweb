import { NextRequest, NextResponse } from "next/server";
import { getActivities } from "@/lib/blog";

// Dynamic route for /api/users/[username]/activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> } // Params is a Promise in recent Next.js
) {
  const { username } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const size = parseInt(searchParams.get("size") || "10", 10);

  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const data = getActivities(username, page, size);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error fetching activities:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
