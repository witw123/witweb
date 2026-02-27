import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "migrations");
const ENV_FILES = [".env.local", ".env"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  for (const name of ENV_FILES) {
    loadEnvFile(path.join(ROOT, name));
  }
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort()
    .map((name) => {
      const fullPath = path.join(MIGRATIONS_DIR, name);
      const sql = fs.readFileSync(fullPath, "utf8");
      return { name, fullPath, sql, checksum: sha256(sql) };
    });
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMap(client) {
  const result = await client.query(
    "SELECT filename, checksum, applied_at FROM schema_migrations ORDER BY filename ASC"
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.filename, row);
  }
  return map;
}

async function runMigrate(client) {
  const migrations = listMigrations();
  await ensureMigrationTable(client);
  const applied = await getAppliedMap(client);

  if (migrations.length === 0) {
    console.log("[migrate] no migration files found");
    return;
  }

  for (const migration of migrations) {
    const existing = applied.get(migration.name);
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `checksum mismatch for ${migration.name}. expected=${existing.checksum} current=${migration.checksum}`
        );
      }
      console.log(`[skip] ${migration.name}`);
      continue;
    }

    console.log(`[apply] ${migration.name}`);
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum]
      );
      await client.query("COMMIT");
      console.log(`[done] ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function runStatus(client) {
  const migrations = listMigrations();
  await ensureMigrationTable(client);
  const applied = await getAppliedMap(client);

  if (migrations.length === 0) {
    console.log("[status] no migration files found");
    return;
  }

  for (const migration of migrations) {
    const row = applied.get(migration.name);
    if (!row) {
      console.log(`[pending] ${migration.name}`);
      continue;
    }
    const changed = row.checksum !== migration.checksum ? " checksum_changed" : "";
    console.log(`[applied] ${migration.name} @ ${row.applied_at}${changed}`);
  }
}

async function main() {
  loadEnv();
  const command = process.argv[2] || "migrate";
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (command === "status") {
      await runStatus(client);
    } else if (command === "migrate") {
      await runMigrate(client);
    } else {
      throw new Error(`unknown command: ${command}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exit(1);
});
