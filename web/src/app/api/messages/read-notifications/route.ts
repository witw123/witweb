import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { markNotificationsAsRead } from "@/lib/blog";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    markNotificationsAsRead(auth.username);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
