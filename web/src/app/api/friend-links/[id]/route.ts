import { NextResponse } from "next/server";
import { getBlogDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { headers } from "next/headers";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

// PUT - Update friend link (admin only)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const username = await verifyToken(token);

    if (!username || username !== adminUsername) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, url, description, avatar_url, sort_order, is_active } = await request.json();
    const db = getBlogDb();

    db.prepare(`
      UPDATE friend_links
      SET name = ?, url = ?, description = ?, avatar_url = ?, 
          sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      url,
      description || null,
      avatar_url || null,
      sort_order ?? 0,
      is_active ?? 1,
      params.id
    );

    return NextResponse.json({ message: "Friend link updated successfully" });
  } catch (error) {
    console.error("Error updating friend link:", error);
    return NextResponse.json({ error: "Failed to update friend link" }, { status: 500 });
  }
}

// DELETE - Delete friend link (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const username = await verifyToken(token);

    if (!username || username !== adminUsername) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getBlogDb();
    db.prepare("DELETE FROM friend_links WHERE id = ?").run(params.id);

    return NextResponse.json({ message: "Friend link deleted successfully" });
  } catch (error) {
    console.error("Error deleting friend link:", error);
    return NextResponse.json({ error: "Failed to delete friend link" }, { status: 500 });
  }
}
