import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/messages";
import { verifyAuth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const messages = getMessages(parseInt(conversationId), auth.username);
    return NextResponse.json(messages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
