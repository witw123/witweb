/**
 * 
 */

import "server-only";
import { getStudioDb } from "./db";
import { apiConfig, appConfig } from "./config";
import { encryptToString, decryptFromString, maskSensitiveValue } from "./security";

export type SensitiveConfigKey = "api_key" | "token" | "webhook_secret" | "oauth_client_secret";

interface ConfigEntry {
  key: string;
  value: string;
  updated_at: string;
}

const configCache = new Map<SensitiveConfigKey, string>();

/**
 */
function getDb() {
  return getStudioDb();
}

/**
 */
export function initSecureConfigTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS secure_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 */
export function setSecureConfig(key: SensitiveConfigKey, value: string): void {
  if (!appConfig.encryptionKey) {
    throw new Error("ENCRYPTION_KEY not set. Cannot store sensitive config securely.");
  }
  
  if (!value) {
    throw new Error("Value cannot be empty");
  }
  
  initSecureConfigTable();
  const db = getDb();
  
  const encrypted = encryptToString(value);
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO secure_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, encrypted, now);
  
  configCache.set(key, value);
  
  console.log(`[SecureConfig] Updated ${key} at ${now}`);
}

/**
 */
export function getSecureConfig(key: SensitiveConfigKey): string | null {
  if (configCache.has(key)) {
    return configCache.get(key)!;
  }
  
  initSecureConfigTable();
  const db = getDb();
  
  const row = db.prepare("SELECT value FROM secure_config WHERE key = ?")
    .get(key) as ConfigEntry | undefined;
  
  if (!row) {
    return null;
  }
  
  try {
    const decrypted = decryptFromString(row.value);
    
    configCache.set(key, decrypted);
    
    return decrypted;
  } catch (error) {
    console.error(`[SecureConfig] Failed to decrypt ${key}:`, error);
    return null;
  }
}

/**
 */
export function deleteSecureConfig(key: SensitiveConfigKey): void {
  initSecureConfigTable();
  const db = getDb();
  
  db.prepare("DELETE FROM secure_config WHERE key = ?").run(key);
  
  configCache.delete(key);
  
  console.log(`[SecureConfig] Deleted ${key}`);
}

/**
 */
export function clearSecureConfigCache(): void {
  configCache.clear();
  console.log("[SecureConfig] Cache cleared");
}

/**
 */
export function listSecureConfigKeys(): Array<{ key: string; updated_at: string }> {
  initSecureConfigTable();
  const db = getDb();
  
  const rows = db.prepare("SELECT key, updated_at FROM secure_config ORDER BY key")
    .all() as ConfigEntry[];
  
  return rows.map(r => ({ key: r.key, updated_at: r.updated_at }));
}

/**
 */
export function getSecureConfigStatus(): {
  keys: Array<{ key: string; updated_at: string; hasValue: boolean; preview: string | null }>;
  encryptionEnabled: boolean;
} {
  const keys = listSecureConfigKeys();
  
  return {
    keys: keys.map(k => {
      const value = configCache.get(k.key as SensitiveConfigKey);
      return {
        key: k.key,
        updated_at: k.updated_at,
        hasValue: !!value || !!getSecureConfig(k.key as SensitiveConfigKey),
        preview: value ? maskSensitiveValue(value) : null,
      };
    }),
    encryptionEnabled: !!appConfig.encryptionKey,
  };
}

// ============================================================================
// ============================================================================

/**
 */
export function getApiKey(): string | null {
  if (apiConfig.sora2.apiKey) {
    return apiConfig.sora2.apiKey;
  }
  
  if (apiConfig.grsai.token) {
    return apiConfig.grsai.token;
  }
  
  return getSecureConfig("api_key") || getSecureConfig("token");
}

/**
 */
export function isApiKeyConfigured(): boolean {
  return !!getApiKey();
}

/**
 */
export function getApiKeyPreview(): string | null {
  const key = getApiKey();
  return key ? maskSensitiveValue(key) : null;
}

/**
 */
export function setApiKey(key: string): void {
  console.warn("[DEPRECATED] Storing API keys in database is deprecated. Use SORA2_API_KEY environment variable instead.");
  setSecureConfig("api_key", key);
}

/**
 */
export function setToken(token: string): void {
  console.warn("[DEPRECATED] Storing tokens in database is deprecated. Use GRSAI_TOKEN environment variable instead.");
  setSecureConfig("token", token);
}

// ============================================================================
// ============================================================================

/**
 */
export function migratePlaintextConfig(key: SensitiveConfigKey, plaintextValue: string): boolean {
  try {
    setSecureConfig(key, plaintextValue);
    console.log(`[SecureConfig] Migrated ${key} to encrypted storage`);
    return true;
  } catch (error) {
    console.error(`[SecureConfig] Failed to migrate ${key}:`, error);
    return false;
  }
}

/**
 */
export function batchMigrateConfigs(configs: Partial<Record<SensitiveConfigKey, string>>): {
  success: string[];
  failed: string[];
} {
  const success: string[] = [];
  const failed: string[] = [];
  
  for (const [key, value] of Object.entries(configs)) {
    if (value && migratePlaintextConfig(key as SensitiveConfigKey, value)) {
      success.push(key);
    } else {
      failed.push(key);
    }
  }
  
  return { success, failed };
}
