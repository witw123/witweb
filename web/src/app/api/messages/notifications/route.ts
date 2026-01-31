import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getRepliesToUser, getLikesToUser, getMentionsToUser, getSystemNotifications } from "@/lib/blog";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") || "replies";
  const page = parseInt(searchParams.get("page") || "1");
  const size = parseInt(searchParams.get("size") || "20");

  try {
    let data: any[] = [];
    if (type === "replies") {
      data = getRepliesToUser(auth.username, page, size);
    } else if (type === "likes") {
      data = getLikesToUser(auth.username, page, size);
    } else if (type === "at") {
      data = getMentionsToUser(auth.username, page, size);
    } else if (type === "system") {
      data = getSystemNotifications(auth.username);
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
