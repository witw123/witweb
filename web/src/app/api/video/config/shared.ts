import { NextRequest } from "next/server";
import { getAuthUser, isAdminUser } from "@/lib/http";
import { getConfig, setApiKey, setHostMode, setQueryDefaults, setToken } from "@/lib/studio";
import {
  assertAuthenticated,
  assertAuthorized,
} from "@/middleware/error-handler";
import { successResponse } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";

const unifiedConfigSchema = z
  .object({
    api_key: z.string().optional(),
    token: z.string().optional(),
    host_mode: z.string().optional(),
    query_defaults: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.api_key !== undefined ||
      data.token !== undefined ||
      data.host_mode !== undefined ||
      data.query_defaults !== undefined,
    {
      message: "至少需要提供一个配置项",
    }
  );

async function assertAdminAccess() {
  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");
  return user;
}

export async function getVideoConfigHandler() {
  await assertAdminAccess();

  const cfg = (await getConfig()) as {
    host_mode?: string;
    query_defaults?: Record<string, unknown>;
  };

  return successResponse({
    host_mode: cfg.host_mode || "auto",
    query_defaults: cfg.query_defaults || {},
  });
}

export async function updateVideoConfigHandler(req: NextRequest) {
  await assertAdminAccess();

  const body = await validateBody(req, unifiedConfigSchema);

  if (body.api_key !== undefined) {
    await setApiKey(body.api_key);
  }

  if (body.token !== undefined) {
    await setToken(body.token);
  }

  if (body.host_mode !== undefined) {
    await setHostMode(body.host_mode);
  }

  if (body.query_defaults !== undefined) {
    await setQueryDefaults(body.query_defaults);
  }

  return successResponse({ ok: true });
}
