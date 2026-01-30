import { getConfig } from "@/lib/studio";

export async function GET() {
  const cfg = getConfig() as { host_mode?: string; query_defaults?: Record<string, any> };
  return Response.json({
    host_mode: cfg.host_mode || "auto",
    query_defaults: cfg.query_defaults || {},
  });
}
