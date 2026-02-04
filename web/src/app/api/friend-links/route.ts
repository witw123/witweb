import { NextResponse } from "next/server";
import { getBlogDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { headers } from "next/headers";

const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "witw";

// GET - Get all active friend links
export async function GET() {
  try {
    const db = getBlogDb();

    const links = db.prepare(`
      SELECT id, name, url, description, avatar_url, sort_order
      FROM friend_links
      WHERE is_active = 1
      ORDER BY sort_order ASC, created_at DESC
    `).all();

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error fetching friend links:", error);
    return NextResponse.json({ error: "Failed to fetch friend links" }, { status: 500 });
  }
}

// POST - Add new friend link (admin only)
export async function POST(request: Request) {
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

    const { name, url, description, avatar_url, sort_order } = await request.json();

    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
    }

    const db = getBlogDb();

    const result = db.prepare(`
      INSERT INTO friend_links (name, url, description, avatar_url, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, url, description || null, avatar_url || null, sort_order || 0);

    return NextResponse.json({
      id: result.lastInsertRowid,
      message: "Friend link added successfully"
    });
  } catch (error) {
    console.error("Error adding friend link:", error);
    return NextResponse.json({ error: "Failed to add friend link" }, { status: 500 });
  }
}
