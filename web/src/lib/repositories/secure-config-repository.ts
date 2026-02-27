import "server-only";
import { pgQuery, pgQueryOne, pgRun } from "@/lib/postgres-query";

type SensitiveConfigKey = "api_key" | "token" | "webhook_secret" | "oauth_client_secret";

type ConfigEntryRow = {
  key: string;
  value: string;
  updated_at: string;
};

class SecureConfigRepository {
  async initTable(): Promise<void> {
    await pgRun(`
      CREATE TABLE IF NOT EXISTS secure_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  async upsert(key: SensitiveConfigKey, encryptedValue: string, updatedAt: string): Promise<void> {
    await pgRun(
      `INSERT INTO secure_config (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, encryptedValue, updatedAt]
    );
  }

  async getByKey(key: SensitiveConfigKey): Promise<ConfigEntryRow | null> {
    return await pgQueryOne<ConfigEntryRow>("SELECT key, value, updated_at FROM secure_config WHERE key = ?", [key]);
  }

  async deleteByKey(key: SensitiveConfigKey): Promise<void> {
    await pgRun("DELETE FROM secure_config WHERE key = ?", [key]);
  }

  async listKeys(): Promise<Array<{ key: string; updated_at: string }>> {
    return await pgQuery<{ key: string; updated_at: string }>("SELECT key, updated_at FROM secure_config ORDER BY key");
  }
}

export const secureConfigRepository = new SecureConfigRepository();
