import { getAuthIdentity, type AuthIdentity } from "@/lib/http";
import { hasAdminPermission } from "@/lib/rbac";
import { API_CAPABILITIES } from "@/lib/api-registry";
import { assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { z } from "@/lib/validate";

export async function requireAdminApiPermission(permission: "api.read" | "api.manage"): Promise<AuthIdentity> {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(Boolean(auth) && hasAdminPermission(auth.role, permission), "需要 API 管理权限");
  return auth as AuthIdentity;
}

export const providerInputSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  protocol_type: z.string().min(1).max(50),
  auth_scheme: z.string().min(1).max(50),
  docs_url: z.string().url().optional().or(z.literal("")),
  default_base_url: z.string().url().optional().or(z.literal("")),
  supports_models: z.boolean().optional(),
  supports_custom_headers: z.boolean().optional(),
  supports_webhook: z.boolean().optional(),
  enabled: z.boolean().optional(),
  config_schema: z.record(z.string(), z.unknown()).optional(),
});

export const providerPatchSchema = providerInputSchema.partial().omit({ code: true });

export const connectionInputSchema = z.object({
  provider_id: z.string().min(1),
  name: z.string().min(1).max(120),
  base_url: z.string().url().optional().or(z.literal("")),
  model: z.string().max(120).optional().or(z.literal("")),
  organization_id: z.string().max(120).optional().or(z.literal("")),
  project_id: z.string().max(120).optional().or(z.literal("")),
  api_version: z.string().max(120).optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "error"]).optional(),
  is_default_candidate: z.boolean().optional(),
  public_config: z.record(z.string(), z.unknown()).optional(),
  secret_config: z
    .object({
      api_key: z.string().optional(),
      token: z.string().optional(),
      secret: z.string().optional(),
      webhook_url: z.string().url().optional().or(z.literal("")),
      extra_headers: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export const connectionPatchSchema = connectionInputSchema.partial();

export const bindingInputSchema = z.object({
  connection_id: z.string().min(1).nullable().optional(),
  model_override: z.string().max(120).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
});

export const capabilityParamSchema = z.object({
  capability: z.enum(API_CAPABILITIES),
});
