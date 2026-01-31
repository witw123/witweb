import { NextRequest, NextResponse } from "next/server";
import { getConversations } from "@/lib/messages";
import { verifyAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversations = getConversations(auth.username);
    return NextResponse.json(conversations);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
