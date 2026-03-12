/**
 * 应用配置
 *
 * 从环境变量读取并验证应用配置
 */

import "server-only";
import { z } from "zod";
import { encryptToString, decryptFromString, maskSensitiveValue } from "./security";

/** 从环境变量解析布尔值 */
const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return defaultValue;
      return value.toLowerCase() === "true" || value === "1";
    });

/** 从环境变量解析整数 */
const intFromEnv = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return defaultValue;
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "必须是整数",
        });
        return z.NEVER;
      }
      return parsed;
    });

/** 从环境变量解析字符串 */
const stringFromEnv = (defaultValue = "") =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value.trim()));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: stringFromEnv(""),
  PG_POOL_MAX: intFromEnv(10),
  PG_IDLE_TIMEOUT_MS: intFromEnv(30000),
  PG_CONNECTION_TIMEOUT_MS: intFromEnv(5000),
  PG_SSL: booleanFromEnv(false),

  AUTH_SECRET: stringFromEnv(""),
  AUTH_EXPIRES_IN: stringFromEnv("1d"),
  ADMIN_USERNAME: stringFromEnv("witw"),
  AUTH_REGISTRATION_ENABLED: booleanFromEnv(true),
  AUTH_MAX_LOGIN_ATTEMPTS: intFromEnv(5),
  AUTH_LOCKOUT_DURATION: intFromEnv(30),

  SORA2_API_KEY: stringFromEnv(""),
  SORA2_BASE_URL: stringFromEnv("https://api.sora2.example.com").pipe(z.string().url()),
  GRSAI_TOKEN: stringFromEnv(""),
  GRSAI_DOMESTIC_URL: stringFromEnv("https://grsai.dakka.com.cn").pipe(z.string().url()),
  GRSAI_OVERSEAS_URL: stringFromEnv("https://grsaiapi.com").pipe(z.string().url()),
  GRSAI_HOST_MODE: z.enum(["auto", "domestic", "overseas"]).default("auto"),

  AGENT_LLM_ENDPOINT: stringFromEnv(""),
  AGENT_LLM_API_KEY: stringFromEnv(""),
  AGENT_LLM_MODEL: stringFromEnv("gemini-3-pro"),
  OPENAI_API_KEY: stringFromEnv(""),
  OPENAI_BASE_URL: stringFromEnv("https://api.openai.com/v1").pipe(z.string().url()),
  DASHSCOPE_API_KEY: stringFromEnv(""),
  DASHSCOPE_BASE_URL: stringFromEnv("https://dashscope.aliyuncs.com/compatible-mode/v1").pipe(z.string().url()),
  DEEPSEEK_API_KEY: stringFromEnv(""),
  DEEPSEEK_BASE_URL: stringFromEnv("https://api.deepseek.com/v1").pipe(z.string().url()),
  GEMINI_API_KEY: stringFromEnv(""),
  GEMINI_BASE_URL: stringFromEnv("https://generativelanguage.googleapis.com/v1beta/openai").pipe(z.string().url()),
  DIFY_BASE_URL: stringFromEnv(""),
  DIFY_API_KEY: stringFromEnv(""),
  N8N_WEBHOOK_URL: stringFromEnv(""),

  APP_NAME: stringFromEnv("WitWeb"),
  APP_URL: stringFromEnv("http://localhost:3000").pipe(z.string().url()),
  ENCRYPTION_KEY: stringFromEnv(""),
  MAX_UPLOAD_SIZE: intFromEnv(10),
  ALLOWED_UPLOAD_TYPES: stringFromEnv("image/jpeg,image/png,image/gif,image/webp"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_REQUEST_LOGGING: booleanFromEnv(true),

  RATE_LIMIT_MAX: intFromEnv(100),
  RATE_LIMIT_WINDOW_MS: intFromEnv(60000),
  API_RATE_LIMIT_MAX: intFromEnv(60),
  LOGIN_RATE_LIMIT_MAX: intFromEnv(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: intFromEnv(900000),
  CORS_ORIGIN: stringFromEnv(""),
  CORS_ENABLED: booleanFromEnv(false),
  CSP_ENABLED: booleanFromEnv(true),
});

const parsedEnvResult = envSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
  const messages = parsedEnvResult.error.issues.map((issue) => {
    const path = issue.path.join(".") || "env";
    return `${path}: ${issue.message}`;
  });
  throw new Error(`[CONFIG ERROR] Invalid environment configuration:\n${messages.join("\n")}`);
}

const env = parsedEnvResult.data;

function isEnvMissing(key: keyof typeof env): boolean {
  const value = process.env[key];
  return value === undefined || value === "";
}

export const dbConfig = {
  postgres: {
    url: env.DATABASE_URL,
    poolMax: env.PG_POOL_MAX,
    idleTimeoutMs: env.PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.PG_CONNECTION_TIMEOUT_MS,
    ssl: env.PG_SSL,
  },
} as const;

export const authConfig = {
  secret: env.AUTH_SECRET,
  expiresIn: env.AUTH_EXPIRES_IN,
  adminUsername: env.ADMIN_USERNAME,
  registrationEnabled: env.AUTH_REGISTRATION_ENABLED,
  maxLoginAttempts: env.AUTH_MAX_LOGIN_ATTEMPTS,
  lockoutDuration: env.AUTH_LOCKOUT_DURATION,
} as const;

export const apiConfig = {
  sora2: {
    apiKey: env.SORA2_API_KEY,
    baseUrl: env.SORA2_BASE_URL,
  },
  grsai: {
    token: env.GRSAI_TOKEN,
    domesticUrl: env.GRSAI_DOMESTIC_URL,
    overseasUrl: env.GRSAI_OVERSEAS_URL,
    hostMode: env.GRSAI_HOST_MODE,
  },
} as const;

export const agentConfig = {
  endpoint: env.AGENT_LLM_ENDPOINT,
  apiKey: env.AGENT_LLM_API_KEY,
  model: env.AGENT_LLM_MODEL,
  providers: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
    },
    dashscope: {
      apiKey: env.DASHSCOPE_API_KEY,
      baseUrl: env.DASHSCOPE_BASE_URL,
    },
    deepseek: {
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL,
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      baseUrl: env.GEMINI_BASE_URL,
    },
  },
  integrations: {
    difyBaseUrl: env.DIFY_BASE_URL,
    difyApiKey: env.DIFY_API_KEY,
    n8nWebhookUrl: env.N8N_WEBHOOK_URL,
  },
} as const;

export const appConfig = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === "development",
  isProd: env.NODE_ENV === "production",
  name: env.APP_NAME,
  url: env.APP_URL,
  encryptionKey: env.ENCRYPTION_KEY,
  maxUploadSize: env.MAX_UPLOAD_SIZE,
  allowedUploadTypes: env.ALLOWED_UPLOAD_TYPES.split(",").map((item) => item.trim()).filter(Boolean),
  logLevel: env.LOG_LEVEL,
  enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
} as const;

export const securityConfig = {
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitWindow: env.RATE_LIMIT_WINDOW_MS,
  apiRateLimitMax: env.API_RATE_LIMIT_MAX,
  loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
  loginRateLimitWindow: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  corsOrigin: env.CORS_ORIGIN || env.APP_URL,
  corsEnabled: env.CORS_ENABLED,
  cspEnabled: env.CSP_ENABLED,
} as const;

interface EncryptedConfigValue {
  encrypted: string;
  updatedAt: string;
}

const configCache = new Map<string, string>();

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

export function setConfigValue(key: string, value: string): string {
  configCache.set(key, value);
  return encryptConfigValue(value);
}

export function clearConfigCache(): void {
  configCache.clear();
}

export interface ConfigValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

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

  if (isEnvMissing("AGENT_LLM_ENDPOINT") || isEnvMissing("AGENT_LLM_API_KEY")) {
    warnings.push("AGENT_LLM_ENDPOINT / AGENT_LLM_API_KEY not fully configured");
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function printConfigValidation(): void {
  const result = validateConfig();

  if (result.missing.length > 0) {
    console.error("[CONFIG ERROR] Missing required configuration:");
    result.missing.forEach((item) => console.error(`  - ${item}`));
  }

  if (result.warnings.length > 0) {
    console.warn("[CONFIG WARNING] Configuration issues:");
    result.warnings.forEach((item) => console.warn(`  - ${item}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("[CONFIG] All configuration validated successfully");
  }
}

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
    agent: {
      endpoint: string;
      apiKey: string;
      model: string;
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
      agent: {
        endpoint: agentConfig.endpoint,
        apiKey: maskSensitiveValue(agentConfig.apiKey),
        model: agentConfig.model,
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

if (typeof window === "undefined") {
  printConfigValidation();
}
