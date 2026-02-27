/**
 */

import "server-only";
import { encryptToString, decryptFromString, maskSensitiveValue } from "./security";

// ============================================================================
// ============================================================================

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      console.warn(`[CONFIG] ${key} not set, using default value`);
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// ============================================================================

export const dbConfig = {
  users: {
    path: getEnv("SORA_USERS_DB_PATH", ""),
  },
  blog: {
    path: getEnv("SORA_BLOG_DB_PATH", ""),
  },
  studio: {
    path: getEnv("SORA_STUDIO_DB_PATH", ""),
  },
  messages: {
    path: getEnv("SORA_MESSAGES_DB_PATH", ""),
  },
  postgres: {
    url: getEnv("DATABASE_URL", ""),
    poolMax: getEnvInt("PG_POOL_MAX", 10),
    idleTimeoutMs: getEnvInt("PG_IDLE_TIMEOUT_MS", 30000),
    connectionTimeoutMs: getEnvInt("PG_CONNECTION_TIMEOUT_MS", 5000),
    ssl: getEnvBool("PG_SSL", false),
  },
} as const;

// ============================================================================
// ============================================================================

export const authConfig = {
  /**
   */
  secret: getEnv("AUTH_SECRET", ""),
  
  /**
   */
  expiresIn: getEnv("AUTH_EXPIRES_IN", "1d"),
  
  /**
   */
  adminUsername: getEnv("ADMIN_USERNAME", "witw"),
  
  /**
   */
  registrationEnabled: getEnvBool("AUTH_REGISTRATION_ENABLED", true),
  
  /**
   */
  maxLoginAttempts: getEnvInt("AUTH_MAX_LOGIN_ATTEMPTS", 5),
  
  /**
   */
  lockoutDuration: getEnvInt("AUTH_LOCKOUT_DURATION", 30),
} as const;

// ============================================================================
// ============================================================================

export const apiConfig = {
  /**
   */
  sora2: {
    apiKey: getEnv("SORA2_API_KEY", ""),
    baseUrl: getEnv("SORA2_BASE_URL", "https://api.sora2.example.com"),
  },
  
  /**
   * GRS AI Token
   */
  grsai: {
    token: getEnv("GRSAI_TOKEN", ""),
    domesticUrl: getEnv("GRSAI_DOMESTIC_URL", "https://grsai.dakka.com.cn"),
    overseasUrl: getEnv("GRSAI_OVERSEAS_URL", "https://grsaiapi.com"),
    hostMode: getEnv("GRSAI_HOST_MODE", "auto") as "auto" | "domestic" | "overseas",
  },
} as const;

// ============================================================================
// ============================================================================

export const appConfig = {
  /**
   */
  env: getEnv("NODE_ENV", "development"),
  
  /**
   */
  isDev: getEnv("NODE_ENV", "development") === "development",
  
  /**
   */
  isProd: getEnv("NODE_ENV", "production") === "production",
  
  /**
   */
  name: getEnv("APP_NAME", "WitWeb"),
  
  /**
   */
  url: getEnv("APP_URL", "http://localhost:3000"),
  
  /**
   */
  encryptionKey: getEnv("ENCRYPTION_KEY", ""),
  
  /**
   */
  maxUploadSize: getEnvInt("MAX_UPLOAD_SIZE", 10),
  
  /**
   */
  allowedUploadTypes: getEnv("ALLOWED_UPLOAD_TYPES", "image/jpeg,image/png,image/gif,image/webp").split(","),
  
  /**
   */
  logLevel: getEnv("LOG_LEVEL", "info"),
  
  /**
   */
  enableRequestLogging: getEnvBool("ENABLE_REQUEST_LOGGING", true),
} as const;

// ============================================================================
// ============================================================================

export const securityConfig = {
  /**
   */
  rateLimitMax: getEnvInt("RATE_LIMIT_MAX", 100),
  
  /**
   */
  rateLimitWindow: getEnvInt("RATE_LIMIT_WINDOW_MS", 60000),
  
  /**
   */
  apiRateLimitMax: getEnvInt("API_RATE_LIMIT_MAX", 60),
  
  /**
   */
  loginRateLimitMax: getEnvInt("LOGIN_RATE_LIMIT_MAX", 5),
  
  /**
   */
  
  /**
   */
  corsOrigin: getEnv("CORS_ORIGIN", appConfig.url),
  
  /**
   */
  corsEnabled: getEnvBool("CORS_ENABLED", false),
  
  /**
   */
  cspEnabled: getEnvBool("CSP_ENABLED", true),
} as const;

// ============================================================================
// ============================================================================

interface EncryptedConfigValue {
  encrypted: string;
  updatedAt: string;
}

const configCache = new Map<string, string>();

/**
 */
export function encryptConfigValue(value: string): string {
  if (!value) return "";
  if (!appConfig.encryptionKey) {
    console.warn("[SECURITY WARNING] ENCRYPTION_KEY not set, storing value in plaintext");
    return JSON.stringify({ plaintext: value, updatedAt: new Date().toISOString() });
  }
  
  const encrypted = encryptToString(value);
  const data: EncryptedConfigValue = {
    encrypted,
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(data);
}

/**
 */
export function decryptConfigValue(storedValue: string): string {
  if (!storedValue) return "";
  
  try {
    const data = JSON.parse(storedValue);
    
    if (data.plaintext !== undefined) {
      return data.plaintext;
    }
    
    if (data.encrypted) {
      return decryptFromString(data.encrypted);
    }
    
    return decryptFromString(storedValue);
  } catch {
    console.error("[CONFIG] Failed to decrypt config value");
    return "";
  }
}

/**
 */
export function getConfigValue(
  key: string,
  encryptedStoredValue?: string,
  envVarName?: string
): string {
  if (envVarName) {
    const envValue = process.env[envVarName];
    if (envValue) {
      return envValue;
    }
  }
  
  if (configCache.has(key)) {
    return configCache.get(key)!;
  }
  
  if (encryptedStoredValue) {
    const decrypted = decryptConfigValue(encryptedStoredValue);
    configCache.set(key, decrypted);
    return decrypted;
  }
  
  return "";
}

/**
 */
export function setConfigValue(key: string, value: string): string {
  configCache.set(key, value);
  return encryptConfigValue(value);
}

/**
 */
export function clearConfigCache(): void {
  configCache.clear();
}

// ============================================================================
// ============================================================================

export interface ConfigValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 */
export function validateConfig(): ConfigValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  if (appConfig.isProd) {
    if (!appConfig.encryptionKey) {
      missing.push("ENCRYPTION_KEY (required in production)");
    }
    if (!authConfig.secret) {
      missing.push("AUTH_SECRET (required in production)");
    }
    if (authConfig.secret && authConfig.secret.length < 32) {
      warnings.push("AUTH_SECRET should be at least 32 characters long in production");
    }
    if (!apiConfig.sora2.apiKey) {
      warnings.push("SORA2_API_KEY not set");
    }
    if (!apiConfig.grsai.token) {
      warnings.push("GRSAI_TOKEN not set");
    }
    if (!dbConfig.postgres.url) {
      warnings.push("DATABASE_URL not set (PostgreSQL disabled)");
    }
  }
  
  if (appConfig.isDev) {
    if (!appConfig.encryptionKey) {
      warnings.push("ENCRYPTION_KEY not set, using fallback (insecure for production)");
    }
    if (!authConfig.secret) {
      warnings.push("AUTH_SECRET not set, using fallback (insecure for production)");
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 */
export function printConfigValidation(): void {
  const result = validateConfig();
  
  if (result.missing.length > 0) {
    console.error("[CONFIG ERROR] Missing required configuration:");
    result.missing.forEach(item => console.error(`  - ${item}`));
  }
  
  if (result.warnings.length > 0) {
    console.warn("[CONFIG WARNING] Configuration issues:");
    result.warnings.forEach(item => console.warn(`  - ${item}`));
  }
  
  if (result.valid && result.warnings.length === 0) {
    console.log("[CONFIG] All configuration validated successfully");
  }
}

// ============================================================================
// ============================================================================

export interface SafeConfigSnapshot {
  app: {
    env: string;
    isDev: boolean;
    isProd: boolean;
    name: string;
    url: string;
    maxUploadSize: number;
    allowedUploadTypes: string[];
  };
  auth: {
    adminUsername: string;
    registrationEnabled: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  api: {
    sora2: {
      apiKey: string;
      baseUrl: string;
    };
    grsai: {
      token: string;
      domesticUrl: string;
      overseasUrl: string;
      hostMode: string;
    };
  };
  security: {
    rateLimitMax: number;
    rateLimitWindow: number;
    corsEnabled: boolean;
    cspEnabled: boolean;
  };
  database: {
    postgresEnabled: boolean;
    poolMax: number;
    ssl: boolean;
  };
}

/**
 */
export function getSafeConfig(): SafeConfigSnapshot {
  return {
    app: {
      env: appConfig.env,
      isDev: appConfig.isDev,
      isProd: appConfig.isProd,
      name: appConfig.name,
      url: appConfig.url,
      maxUploadSize: appConfig.maxUploadSize,
      allowedUploadTypes: appConfig.allowedUploadTypes,
    },
    auth: {
      adminUsername: authConfig.adminUsername,
      registrationEnabled: authConfig.registrationEnabled,
      maxLoginAttempts: authConfig.maxLoginAttempts,
      lockoutDuration: authConfig.lockoutDuration,
    },
    api: {
      sora2: {
        apiKey: maskSensitiveValue(apiConfig.sora2.apiKey),
        baseUrl: apiConfig.sora2.baseUrl,
      },
      grsai: {
        token: maskSensitiveValue(apiConfig.grsai.token),
        domesticUrl: apiConfig.grsai.domesticUrl,
        overseasUrl: apiConfig.grsai.overseasUrl,
        hostMode: apiConfig.grsai.hostMode,
      },
    },
    security: {
      rateLimitMax: securityConfig.rateLimitMax,
      rateLimitWindow: securityConfig.rateLimitWindow,
      corsEnabled: securityConfig.corsEnabled,
      cspEnabled: securityConfig.cspEnabled,
    },
    database: {
      postgresEnabled: !!dbConfig.postgres.url,
      poolMax: dbConfig.postgres.poolMax,
      ssl: dbConfig.postgres.ssl,
    },
  };
}

// ============================================================================
// ============================================================================

if (typeof window === "undefined") {
  printConfigValidation();
}
