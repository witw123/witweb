/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Client } = require("pg");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT, "..", "data");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

// Load env files when running migration directly with Node.
loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, ".env.local"));

const SQLITE_PATHS = {
  users: process.env.SORA_USERS_DB_PATH || path.join(DATA_DIR, "users.db"),
  blog: process.env.SORA_BLOG_DB_PATH || path.join(DATA_DIR, "blog.db"),
  studio: process.env.SORA_STUDIO_DB_PATH || path.join(DATA_DIR, "studio.db"),
  messages: process.env.SORA_MESSAGES_DB_PATH || path.join(DATA_DIR, "messages.db"),
};

const DATABASE_URL = process.env.DATABASE_URL;
const PG_SCHEMA = process.env.PG_SCHEMA || "public";

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function tableExists(sqlite, table) {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function listColumns(sqlite, table) {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  return rows.map((r) => r.name);
}

async function createSchema(client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}`);

  const ddl = [
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("users")} (
      id BIGINT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      nickname TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      bio TEXT,
      balance DOUBLE PRECISION,
      created_at TEXT,
      last_read_notifications_at TEXT,
      is_bot INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("follows")} (
      id BIGINT PRIMARY KEY,
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("posts")} (
      id BIGINT PRIMARY KEY,
      title TEXT,
      slug TEXT UNIQUE,
      content TEXT,
      created_at TEXT,
      updated_at TEXT,
      author TEXT,
      tags TEXT,
      status TEXT,
      category_id BIGINT,
      view_count BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("categories")} (
      id BIGINT PRIMARY KEY,
      name TEXT,
      slug TEXT,
      description TEXT,
      sort_order INTEGER,
      is_active INTEGER,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("friend_links")} (
      id BIGINT PRIMARY KEY,
      name TEXT,
      url TEXT,
      description TEXT,
      avatar_url TEXT,
      sort_order INTEGER,
      is_active INTEGER,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("likes")} (
      id BIGINT PRIMARY KEY,
      post_id BIGINT,
      username TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("dislikes")} (
      id BIGINT PRIMARY KEY,
      post_id BIGINT,
      username TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("comments")} (
      id BIGINT PRIMARY KEY,
      post_id BIGINT,
      author TEXT,
      content TEXT,
      created_at TEXT,
      parent_id BIGINT,
      ip_address TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("comment_votes")} (
      id BIGINT PRIMARY KEY,
      comment_id BIGINT,
      username TEXT,
      value INTEGER,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("favorites")} (
      id BIGINT PRIMARY KEY,
      post_id BIGINT,
      username TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("site_visits")} (
      id BIGINT PRIMARY KEY,
      visitor_id TEXT,
      page_url TEXT,
      user_agent TEXT,
      ip_address TEXT,
      visited_at TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("unique_visitors")} (
      visitor_id TEXT PRIMARY KEY,
      first_visit TEXT,
      last_visit TEXT,
      visit_count BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("video_tasks")} (
      id TEXT PRIMARY KEY,
      username TEXT,
      task_type TEXT,
      status TEXT,
      progress INTEGER,
      prompt TEXT,
      model TEXT,
      url TEXT,
      aspect_ratio TEXT,
      duration INTEGER,
      remix_target_id TEXT,
      size TEXT,
      pid TEXT,
      timestamps TEXT,
      result_json TEXT,
      failure_reason TEXT,
      error TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("video_results")} (
      id BIGINT PRIMARY KEY,
      task_id TEXT,
      url TEXT,
      remove_watermark INTEGER,
      pid TEXT,
      character_id TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("characters")} (
      id BIGINT PRIMARY KEY,
      username TEXT,
      character_id TEXT,
      name TEXT,
      source_task_id TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("studio_config")} (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("studio_history")} (
      id BIGINT PRIMARY KEY,
      file TEXT,
      prompt TEXT,
      time BIGINT,
      task_id TEXT,
      pid TEXT,
      url TEXT,
      duration_seconds BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("studio_task_times")} (
      task_id TEXT PRIMARY KEY,
      ts BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("studio_active_tasks")} (
      id TEXT PRIMARY KEY,
      prompt TEXT,
      start_time BIGINT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("agent_runs")} (
      id TEXT PRIMARY KEY,
      username TEXT,
      goal TEXT,
      agent_type TEXT,
      status TEXT,
      model TEXT,
      error_message TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("agent_steps")} (
      id BIGINT PRIMARY KEY,
      run_id TEXT,
      step_key TEXT,
      step_title TEXT,
      status TEXT,
      input_json TEXT,
      output_json TEXT,
      started_at TEXT,
      finished_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("agent_artifacts")} (
      id BIGINT PRIMARY KEY,
      run_id TEXT,
      kind TEXT,
      content TEXT,
      meta_json TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("topic_sources")} (
      id BIGINT PRIMARY KEY,
      name TEXT,
      url TEXT,
      type TEXT,
      parser_config_json TEXT,
      enabled INTEGER,
      last_fetch_status TEXT,
      last_fetch_error TEXT,
      last_fetched_at TEXT,
      last_fetch_count BIGINT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("topic_items")} (
      id BIGINT PRIMARY KEY,
      source_id BIGINT,
      title TEXT,
      url TEXT,
      summary TEXT,
      published_at TEXT,
      score DOUBLE PRECISION,
      raw_json TEXT,
      fetched_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("topic_keywords")} (
      id BIGINT PRIMARY KEY,
      keyword TEXT,
      weight DOUBLE PRECISION,
      enabled INTEGER,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("radar_notifications")} (
      id BIGINT PRIMARY KEY,
      created_by TEXT,
      type TEXT,
      name TEXT,
      webhook_url TEXT,
      secret TEXT,
      enabled INTEGER,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("radar_alert_rules")} (
      id BIGINT PRIMARY KEY,
      created_by TEXT,
      name TEXT,
      rule_type TEXT,
      keyword TEXT,
      source_id BIGINT,
      min_score DOUBLE PRECISION,
      channel_id BIGINT,
      enabled INTEGER,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("radar_alert_logs")} (
      id BIGINT PRIMARY KEY,
      created_by TEXT,
      item_id BIGINT,
      channel_id BIGINT,
      rule_id BIGINT,
      status TEXT,
      response_text TEXT,
      error_text TEXT,
      sent_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("radar_topics")} (
      id BIGINT PRIMARY KEY,
      created_by TEXT,
      kind TEXT,
      title TEXT,
      summary TEXT,
      content TEXT,
      source_name TEXT,
      source_url TEXT,
      score DOUBLE PRECISION,
      tags_json TEXT,
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("secure_config")} (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("conversations")} (
      id BIGINT PRIMARY KEY,
      user1 TEXT,
      user2 TEXT,
      last_message TEXT,
      last_time TEXT,
      unread_count_user1 INTEGER,
      unread_count_user2 INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(PG_SCHEMA)}.${quoteIdent("private_messages")} (
      id BIGINT PRIMARY KEY,
      conversation_id BIGINT,
      sender TEXT,
      receiver TEXT,
      content TEXT,
      is_read INTEGER,
      created_at TEXT
    )`,
  ];

  for (const sql of ddl) {
    await client.query(sql);
  }

  // Backward-compatible column patching for tables created by earlier script versions.
  await client.query(
    `ALTER TABLE ${quoteIdent(PG_SCHEMA)}.${quoteIdent("site_visits")}
     ADD COLUMN IF NOT EXISTS visited_at TEXT`
  );
}

async function copyTable(sqlite, client, table) {
  if (!tableExists(sqlite, table)) {
    console.log(`[skip] ${table} not found in source`);
    return 0;
  }

  const cols = listColumns(sqlite, table);
  if (cols.length === 0) return 0;

  const rows = sqlite.prepare(`SELECT ${cols.map((c) => quoteIdent(c)).join(", ")} FROM ${quoteIdent(table)}`).all();
  if (rows.length === 0) {
    console.log(`[ok] ${table}: 0 rows`);
    return 0;
  }

  const colSql = cols.map(quoteIdent).join(", ");
  const target = `${quoteIdent(PG_SCHEMA)}.${quoteIdent(table)}`;

  const batchSize = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const placeholders = [];

    batch.forEach((row, rowIndex) => {
      const rowPlaceholders = [];
      cols.forEach((col, colIndex) => {
        values.push(row[col]);
        rowPlaceholders.push(`$${rowIndex * cols.length + colIndex + 1}`);
      });
      placeholders.push(`(${rowPlaceholders.join(",")})`);
    });

    const sql = `INSERT INTO ${target} (${colSql}) VALUES ${placeholders.join(",")} ON CONFLICT DO NOTHING`;
    await client.query(sql, values);
    inserted += batch.length;
  }

  console.log(`[ok] ${table}: ${inserted} rows`);
  return inserted;
}

async function migrateDb(sqlitePath, client, tables) {
  if (!fs.existsSync(sqlitePath)) {
    console.warn(`[warn] sqlite db not found: ${sqlitePath}`);
    return;
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  try {
    for (const table of tables) {
      await copyTable(sqlite, client, table);
    }
  } finally {
    sqlite.close();
  }
}

async function run() {
  if (!DATABASE_URL) {
    throw new Error(
      "缺少 DATABASE_URL。请在 web/.env.local 中设置 PostgreSQL 连接串，例如：DATABASE_URL=postgres://user:password@localhost:5432/witweb"
    );
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log("[start] ensuring PostgreSQL schema...");
    await createSchema(client);

    console.log("[start] migrating users db...");
    await migrateDb(SQLITE_PATHS.users, client, ["users", "follows"]);

    console.log("[start] migrating blog db...");
    await migrateDb(SQLITE_PATHS.blog, client, [
      "posts",
      "categories",
      "friend_links",
      "likes",
      "dislikes",
      "comments",
      "comment_votes",
      "favorites",
      "site_visits",
      "unique_visitors",
    ]);

    console.log("[start] migrating studio db...");
    await migrateDb(SQLITE_PATHS.studio, client, [
      "video_tasks",
      "video_results",
      "characters",
      "studio_config",
      "studio_history",
      "studio_task_times",
      "studio_active_tasks",
      "agent_runs",
      "agent_steps",
      "agent_artifacts",
      "topic_sources",
      "topic_items",
      "topic_keywords",
      "radar_notifications",
      "radar_alert_rules",
      "radar_alert_logs",
      "radar_topics",
      "secure_config",
    ]);

    console.log("[start] migrating messages db...");
    await migrateDb(SQLITE_PATHS.messages, client, ["conversations", "private_messages"]);

    console.log("[done] sqlite -> postgresql migration finished");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[error] migration failed:", error);
  process.exit(1);
});
