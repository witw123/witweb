import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/messages";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { receiver, content } = await req.json();
    if (!receiver || !content) {
      return NextResponse.json({ error: "Missing receiver or content" }, { status: 400 });
    }

    const result = sendMessage(auth.username, receiver, content);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
