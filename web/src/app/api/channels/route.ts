import { initDb } from "@/lib/db-init";
import { createChannel, createServer, listChannels, listCategories, listServers } from "@/lib/channel";

export async function GET(req: Request) {
  try {
    initDb();
    const { searchParams } = new URL(req.url);
    const serverIdParam = searchParams.get("server_id");
    const mode = searchParams.get("mode");

    if (mode === "servers") {
      return Response.json(listServers());
    }

    let serverId: number | null = serverIdParam ? parseInt(serverIdParam) : null;
    if (serverIdParam && isNaN(serverId!)) serverId = null;

    // If no serverId provided, get the first one
    let activeServerId = serverId;
    if (!activeServerId) {
      const servers = listServers() as any[];
      if (servers.length > 0) activeServerId = servers[0].id;
    }

    if (!activeServerId) return Response.json([]);

    const categories = listCategories(activeServerId) as any[];
    const channels = listChannels(activeServerId) as any[];

    // Group channels by category
    const result = categories.map(cat => ({
      ...cat,
      channels: channels.filter(c => c.category_id === cat.id)
    }));

    // Also include channels with no category
    const uncategorized = channels.filter(c => !c.category_id);
    if (uncategorized.length > 0) {
      result.push({
        id: 0,
        name: "未分类",
        channels: uncategorized
      } as any);
    }

    return Response.json(result);
  } catch (error: any) {
    console.error("[API ERROR] GET /api/channels:", error);
    return Response.json({ detail: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    initDb();
    const { getAuthUser } = await import("@/lib/http");
    const { getUserByUsername } = await import("@/lib/user");
    const username = await getAuthUser();
    if (!username) return Response.json({ detail: "Unauthorized" }, { status: 401 });

    const user = getUserByUsername(username) as any;
    if (!user) return Response.json({ detail: "User not found" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, description, server_id, category_id, type, icon_url } = body;

    if (!name) return Response.json({ detail: "Name required" }, { status: 400 });

    if (type === "server") {
      const res = createServer(name, user.id, icon_url);
      if (!res.ok) {
        return Response.json({ detail: res.error === "exists" ? "Server name exists" : "Failed to create server" }, { status: 400 });
      }
      return Response.json(res.server);
    }

    // Default: create channel (Admin only check for now to match old behavior)
    const admin = process.env.ADMIN_USERNAME || "witw";
    if (username !== admin) return Response.json({ detail: "Admin access required" }, { status: 403 });

    const res = createChannel(name, description, server_id, category_id);
    if (!res.ok) {
      const detail = res.error === "exists" ? "Channel already exists" : "Failed to create channel";
      return Response.json({ detail }, { status: 400 });
    }
    return Response.json(res.channel);
  } catch (error: any) {
    console.error("[API ERROR] POST /api/channels:", error);
    return Response.json({ detail: error.message || "Internal Server Error" }, { status: 500 });
  }
}
