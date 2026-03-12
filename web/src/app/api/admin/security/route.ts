/**
 * 安全设置管理 API
 *
 * 管理员管理安全配置的接口，包括：
 * - 查看安全配置状态（环境、验证、API 密钥状态）
 * - 设置敏感配置（API 密钥、Token、Webhook 密钥等）
 * - 清理配置缓存
 *
 * 需要安全设置管理权限
 *
 * @route /api/admin/security
 * @method GET - 获取安全配置状态
 * @method POST - 设置安全配置或清理缓存
 */
import { getAuthIdentity } from "@/lib/http";
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
import { recordAdminAudit } from "@/lib/admin-audit";
import { hasAdminPermission } from "@/lib/rbac";

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

/**
 * 获取安全配置状态
 *
 * 返回当前系统的安全配置信息，包括环境变量、验证状态、API 密钥信息等
 *
 * @returns {Response} 包含完整安全配置状态的响应
 */
export const GET = withErrorHandler(async (req) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "security.manage"), "需要安全设置管理权限");

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

/**
 * 设置安全配置或清理缓存
 *
 * 支持两种操作：
 * - setConfig: 设置敏感配置项（API 密钥、Token 等）
 * - clearCache: 清理配置缓存
 *
 * @param {string} action - 操作类型：setConfig 或 clearCache
 * @param {string} [key] - 配置项名称（setConfig 时需要）
 * @param {string} [value] - 配置值（setConfig 时需要）
 * @returns {Response} 操作结果响应
 */
export const POST = withErrorHandler(async (req) => {
  const auth = await getAuthIdentity();
  assertAuthenticated(auth?.username);
  assertAuthorized(!!auth && hasAdminPermission(auth.role, "security.manage"), "需要安全设置管理权限");

  const body = await validateBody(req, postSchema);
  const context = await createSecurityContext(req);

  if (body.action === "clearCache") {
    clearSecureConfigCache();
    securityLog("admin_security_cache_cleared", context, { admin: auth.username });
    await recordAdminAudit({
      actor: auth.username,
      action: "admin.security.clear_cache",
      targetType: "security",
      targetId: "config-cache",
      req,
    });
    return successResponse({
      message: "Configuration cache cleared",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await setSecureConfig(body.key as SensitiveConfigKey, body.value);
    securityLog("admin_security_config_set", context, {
      key: body.key,
      admin: auth.username,
      source: "api",
    });

    await recordAdminAudit({
      actor: auth.username,
      action: "admin.security.set_config",
      targetType: "security",
      targetId: body.key,
      detail: { key: body.key },
      req,
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

