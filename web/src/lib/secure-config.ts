/**
 * 
 */

import "server-only";
import { apiConfig, appConfig } from "./config";
import { encryptToString, decryptFromString, maskSensitiveValue } from "./security";
import { secureConfigRepository } from "./repositories";

export type SensitiveConfigKey = "api_key" | "token" | "webhook_secret" | "oauth_client_secret";

interface ConfigEntry {
  value: string;
}

const configCache = new Map<SensitiveConfigKey, string>();

export async function initSecureConfigTable(): Promise<void> {
  await secureConfigRepository.initTable();
}

export async function setSecureConfig(key: SensitiveConfigKey, value: string): Promise<void> {
  if (!appConfig.encryptionKey) {
    throw new Error("ENCRYPTION_KEY not set. Cannot store sensitive config securely.");
  }

  if (!value) {
    throw new Error("Value cannot be empty");
  }

  await initSecureConfigTable();

  const encrypted = encryptToString(value);
  const now = new Date().toISOString();

  await secureConfigRepository.upsert(key, encrypted, now);

  configCache.set(key, value);

  console.log(`[SecureConfig] Updated ${key} at ${now}`);
}

export async function getSecureConfig(key: SensitiveConfigKey): Promise<string | null> {
  if (configCache.has(key)) {
    return configCache.get(key)!;
  }

  await initSecureConfigTable();
  const row = (await secureConfigRepository.getByKey(key)) as ConfigEntry | null;

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

export async function deleteSecureConfig(key: SensitiveConfigKey): Promise<void> {
  await initSecureConfigTable();
  await secureConfigRepository.deleteByKey(key);
  configCache.delete(key);
  console.log(`[SecureConfig] Deleted ${key}`);
}

export function clearSecureConfigCache(): void {
  configCache.clear();
  console.log("[SecureConfig] Cache cleared");
}

export async function listSecureConfigKeys(): Promise<Array<{ key: string; updated_at: string }>> {
  await initSecureConfigTable();
  return await secureConfigRepository.listKeys();
}

export async function getSecureConfigStatus(): Promise<{
  keys: Array<{ key: string; updated_at: string; hasValue: boolean; preview: string | null }>;
  encryptionEnabled: boolean;
}> {
  const keys = await listSecureConfigKeys();

  return {
    keys: await Promise.all(
      keys.map(async (k) => {
        const value = configCache.get(k.key as SensitiveConfigKey);
        const storedValue = value || (await getSecureConfig(k.key as SensitiveConfigKey));
        return {
          key: k.key,
          updated_at: k.updated_at,
          hasValue: !!storedValue,
          preview: value ? maskSensitiveValue(value) : null,
        };
      })
    ),
    encryptionEnabled: !!appConfig.encryptionKey,
  };
}

export async function getApiKey(): Promise<string | null> {
  if (apiConfig.sora2.apiKey) {
    return apiConfig.sora2.apiKey;
  }

  if (apiConfig.grsai.token) {
    return apiConfig.grsai.token;
  }

  return (await getSecureConfig("api_key")) || (await getSecureConfig("token"));
}

export async function isApiKeyConfigured(): Promise<boolean> {
  return !!(await getApiKey());
}

export async function getApiKeyPreview(): Promise<string | null> {
  const key = await getApiKey();
  return key ? maskSensitiveValue(key) : null;
}

export async function setApiKey(key: string): Promise<void> {
  console.warn("[DEPRECATED] Storing API keys in database is deprecated. Use SORA2_API_KEY environment variable instead.");
  await setSecureConfig("api_key", key);
}

export async function setToken(token: string): Promise<void> {
  console.warn("[DEPRECATED] Storing tokens in database is deprecated. Use GRSAI_TOKEN environment variable instead.");
  await setSecureConfig("token", token);
}

export async function migratePlaintextConfig(key: SensitiveConfigKey, plaintextValue: string): Promise<boolean> {
  try {
    await setSecureConfig(key, plaintextValue);
    console.log(`[SecureConfig] Migrated ${key} to encrypted storage`);
    return true;
  } catch (error) {
    console.error(`[SecureConfig] Failed to migrate ${key}:`, error);
    return false;
  }
}

export async function batchMigrateConfigs(configs: Partial<Record<SensitiveConfigKey, string>>): Promise<{
  success: string[];
  failed: string[];
}> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const [key, value] of Object.entries(configs)) {
    if (value && (await migratePlaintextConfig(key as SensitiveConfigKey, value))) {
      success.push(key);
    } else {
      failed.push(key);
    }
  }

  return { success, failed };
}
