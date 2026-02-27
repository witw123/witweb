import "server-only";
import { getStudioDb } from "@/lib/db";
type SensitiveConfigKey = "api_key" | "token" | "webhook_secret" | "oauth_client_secret";

type ConfigEntryRow = {
  key: string;
  value: string;
  updated_at: string;
};

class SecureConfigRepository {
  private db() {
    return getStudioDb();
  }

  initTable(): void {
    this.db().exec(`
      CREATE TABLE IF NOT EXISTS secure_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  upsert(key: SensitiveConfigKey, encryptedValue: string, updatedAt: string): void {
    this.db()
      .prepare(
        `INSERT INTO secure_config (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(key, encryptedValue, updatedAt);
  }

  getByKey(key: SensitiveConfigKey): ConfigEntryRow | null {
    return (this.db().prepare("SELECT key, value, updated_at FROM secure_config WHERE key = ?").get(key) as
      | ConfigEntryRow
      | undefined) || null;
  }

  deleteByKey(key: SensitiveConfigKey): void {
    this.db().prepare("DELETE FROM secure_config WHERE key = ?").run(key);
  }

  listKeys(): Array<{ key: string; updated_at: string }> {
    const rows = this.db().prepare("SELECT key, updated_at FROM secure_config ORDER BY key").all() as Array<{
      key: string;
      updated_at: string;
    }>;
    return rows;
  }
}

export const secureConfigRepository = new SecureConfigRepository();
