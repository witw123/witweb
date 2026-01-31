import { NextRequest, NextResponse } from "next/server";
import { getUnreadTotal } from "@/lib/messages";
import { getUnreadNotificationCount } from "@/lib/blog";
import { verifyAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ unread_count: 0 }); // Silent for badge

  try {
    const msgTotal = getUnreadTotal(auth.username);
    const notifTotal = getUnreadNotificationCount(auth.username);
    return NextResponse.json({ unread_count: msgTotal + notifTotal });
  } catch (err: any) {
    return NextResponse.json({ unread_count: 0 });
  }
}
