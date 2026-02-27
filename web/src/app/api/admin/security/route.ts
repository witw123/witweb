import { getAuthUser, isAdminUser } from "@/lib/http";
import { withErrorHandler, assertAuthenticated, assertAuthorized } from "@/middleware/error-handler";
import { successResponse, errorResponses } from "@/lib/api-response";
import { validateBody, z } from "@/lib/validate";
import {
  getSecureConfigStatus,
  setSecureConfig,
  getApiKeyPreview,
  clearSecureConfigCache,
  type SensitiveConfigKey,
} from "@/lib/secure-config";
import { apiConfig, appConfig, getSafeConfig, validateConfig } from "@/lib/config";
import { maskSensitiveValue } from "@/lib/security";
import { createSecurityContext, securityLog } from "@/lib/security-middleware";

const validKeys = ["api_key", "token", "webhook_secret", "oauth_client_secret"] as const;

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setConfig"),
    key: z.enum(validKeys),
    value: z.string().min(1, "Missing value"),
  }),
  z.object({
    action: z.literal("clearCache"),
  }),
]);

export const GET = withErrorHandler(async (req) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const context = await createSecurityContext(req);
  securityLog("admin_security_status_view", context);

  const validation = validateConfig();
  const secureConfigStatus = await getSecureConfigStatus();

  return successResponse({
    environment: appConfig.env,
    isProduction: appConfig.isProd,
    validation: {
      valid: validation.valid,
      missing: validation.missing,
      warnings: validation.warnings,
    },
    api: {
      sora2: {
        fromEnv: !!apiConfig.sora2.apiKey,
        preview: apiConfig.sora2.apiKey ? maskSensitiveValue(apiConfig.sora2.apiKey) : null,
        baseUrl: apiConfig.sora2.baseUrl,
      },
      grsai: {
        fromEnv: !!apiConfig.grsai.token,
        preview: apiConfig.grsai.token ? maskSensitiveValue(apiConfig.grsai.token) : null,
        hostMode: apiConfig.grsai.hostMode,
      },
    },
    secureStorage: {
      encryptionEnabled: secureConfigStatus.encryptionEnabled,
      storedConfigs: secureConfigStatus.keys,
    },
    effectiveApiKey: await getApiKeyPreview(),
    configSnapshot: getSafeConfig(),
    timestamp: new Date().toISOString(),
  });
});

export const POST = withErrorHandler(async (req) => {

  const user = await getAuthUser();
  assertAuthenticated(user);
  assertAuthorized(isAdminUser(user), "需要管理员权限");

  const body = await validateBody(req, postSchema);
  const context = await createSecurityContext(req);

  if (body.action === "clearCache") {
    clearSecureConfigCache();
    securityLog("admin_security_cache_cleared", context, { admin: user });
    return successResponse({
      message: "Configuration cache cleared",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await setSecureConfig(body.key as SensitiveConfigKey, body.value);
    securityLog("admin_security_config_set", context, {
      key: body.key,
      admin: user,
      source: "api",
    });

    const warning =
      "Config stored in database. For production use, it is recommended to set " +
      (body.key === "api_key" ? "SORA2_API_KEY" : "GRSAI_TOKEN") +
      " environment variable instead.";

    return successResponse({
      message: "Configuration saved securely",
      warning,
      preview: maskSensitiveValue(body.value),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Security] Failed to save config:", error);
    return errorResponses.internal("Failed to save configuration");
  }
});
