/**
 * 瀹夊叏閰嶇疆绠＄悊 API
 * 
 * GET  - 鑾峰彇瀹夊叏閰嶇疆鐘舵€?
 * POST - 璁剧疆鏁忔劅閰嶇疆锛堝姞瀵嗗瓨鍌級
 */

import { NextRequest } from "next/server";
import { initDb } from "@/lib/db-init";
import { adminAuthMiddleware, createJsonResponse, createSecurityContext, securityLog } from "@/lib/security-middleware";
import { validateRequestMiddleware } from "@/lib/security-middleware";
import {
  getSecureConfigStatus,
  setSecureConfig,
  getApiKeyPreview,
  clearSecureConfigCache,
  SensitiveConfigKey,
} from "@/lib/secure-config";
import { apiConfig, appConfig, getSafeConfig, validateConfig } from "@/lib/config";
import { maskSensitiveValue } from "@/lib/security";

/**
 * GET /api/admin/security
 * 鑾峰彇瀹夊叏閰嶇疆鐘舵€?
 */
export async function GET(req: NextRequest) {
  initDb();
  
  const user = await adminAuthMiddleware(req);
  if (user instanceof Response) return user;
  
  // 2. 璁板綍璁块棶鏃ュ織
  const context = await createSecurityContext(req);
  securityLog("admin_security_status_view", context);
  
  const validation = validateConfig();
  
  // 4. 鑾峰彇瀹夊叏閰嶇疆鐘舵€?
  const secureConfigStatus = getSecureConfigStatus();
  
  return createJsonResponse({
    environment: appConfig.env,
    isProduction: appConfig.isProd,
    
    validation: {
      valid: validation.valid,
      missing: validation.missing,
      warnings: validation.warnings,
    },
    
    // API 閰嶇疆鐘舵€?
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
    
    // 褰撳墠鐢熸晥鐨?API 瀵嗛挜
    effectiveApiKey: getApiKeyPreview(),
    
    // 瀹屾暣閰嶇疆蹇収锛堝凡鑴辨晱锛?
    configSnapshot: getSafeConfig(),
    
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/admin/security
 * 璁剧疆鏁忔劅閰嶇疆
 * 
 * 璇锋眰浣擄細
 * {
 *   "action": "setConfig",
 *   "key": "api_key" | "token",
 *   "value": "secret-value"
 * }
 * 
 * 鎴栵細
 * {
 *   "action": "clearCache"
 * }
 */
export async function POST(req: NextRequest) {
  initDb();
  
  const user = await adminAuthMiddleware(req);
  if (user instanceof Response) return user;
  
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createJsonResponse({ error: "Invalid JSON body" }, 400);
  }
  
  const validation = validateRequestMiddleware<{
    action: "setConfig" | "clearCache";
    key?: SensitiveConfigKey;
    value?: string;
  }>(body, {
    action: {
      required: true,
      type: "string",
      pattern: /^(setConfig|clearCache)$/,
    },
    key: {
      required: false,
      type: "string",
    },
    value: {
      required: false,
      type: "string",
    },
  });
  
  if (!validation.valid) {
    return validation.response;
  }
  
  const { action, key, value } = validation.data;
  const context = await createSecurityContext(req);
  
  if (action === "setConfig") {
    if (!key || !value) {
      return createJsonResponse(
        { error: "Missing key or value" },
        400
      );
    }
    
    // 楠岃瘉 key
    const validKeys: SensitiveConfigKey[] = ["api_key", "token", "webhook_secret", "oauth_client_secret"];
    if (!validKeys.includes(key)) {
      return createJsonResponse(
        { error: "Invalid config key", validKeys },
        400
      );
    }
    
    try {
      setSecureConfig(key, value);
      
      securityLog("admin_security_config_set", context, { 
        key, 
        admin: user,
        source: "api",
      });
      
      // 璀﹀憡锛氭帹鑽愪娇鐢ㄧ幆澧冨彉閲?
      const warning = 
        "Config stored in database. For production use, it is recommended to set " +
        (key === "api_key" ? "SORA2_API_KEY" : "GRSAI_TOKEN") +
        " environment variable instead.";
      
      return createJsonResponse({
        success: true,
        message: "Configuration saved securely",
        warning,
        preview: maskSensitiveValue(value),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Security] Failed to save config:", error);
      return createJsonResponse(
        { error: "Failed to save configuration" },
        500
      );
    }
  }
  
  if (action === "clearCache") {
    clearSecureConfigCache();
    
    securityLog("admin_security_cache_cleared", context, { admin: user });
    
    return createJsonResponse({
      success: true,
      message: "Configuration cache cleared",
      timestamp: new Date().toISOString(),
    });
  }
  
  return createJsonResponse({ error: "Invalid action" }, 400);
}

/**
 * 浣跨敤绀轰緥锛?
 * 
 * 1. 鏌ョ湅瀹夊叏閰嶇疆鐘舵€侊細
 * GET /api/admin/security
 * Authorization: Bearer <admin-token>
 * 
 * 2. 璁剧疆 API 瀵嗛挜锛?
 * POST /api/admin/security
 * Authorization: Bearer <admin-token>
 * Content-Type: application/json
 * 
 * {
 *   "action": "setConfig",
 *   "key": "api_key",
 *   "value": "sk-xxxxxx"
 * }
 * 
 * 3. 娓呴櫎閰嶇疆缂撳瓨锛?
 * POST /api/admin/security
 * Authorization: Bearer <admin-token>
 * Content-Type: application/json
 * 
 * {
 *   "action": "clearCache"
 * }
 */
