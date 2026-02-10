import { getAuthUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated } from "@/middleware/error-handler";
import { validateBody, z } from "@/lib/validate";
import { successResponse } from "@/lib/api-response";
import { initDb } from "@/lib/db-init";
import { createRadarSource, listRadarSources } from "@/lib/topic-radar";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url(),
  type: z.enum(["rss", "html", "api"]).default("rss"),
  parser_config_json: z.string().trim().max(10000).optional(),
  enabled: z.boolean().optional(),
});

export const GET = withErrorHandler(async () => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);
  return successResponse({ items: listRadarSources(user) });
});

export const POST = withErrorHandler(async (req) => {
  initDb();
  const user = await getAuthUser();
  assertAuthenticated(user);

  const body = await validateBody(req, bodySchema);
  const created = createRadarSource({
    username: user,
    name: body.name,
    url: body.url,
    type: body.type ?? "rss",
    parserConfigJson: body.parser_config_json,
    enabled: body.enabled,
  });

  return successResponse({ id: created.id });
});
