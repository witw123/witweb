
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'data', 'channel.db');
const db = new Database(dbPath);
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='channels'").get();
console.log("Schema:", schema.sql);
const indices = db.prepare("PRAGMA index_list(channels)").all();
console.log("Indices:", JSON.stringify(indices, null, 2));
for (const idx of indices) {
  const info = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
  console.log(`Index ${idx.name} info:`, JSON.stringify(info, null, 2));
}
db.close();
