import { getConfig } from "@/lib/studio";

export async function GET() {
  return Response.json({
    host_mode: getConfig().host_mode || "auto",
    query_defaults: getConfig().query_defaults || {},
  });
}
