
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'data', 'channel.db');
const db = new Database(dbPath);

console.log("Starting migration to remove UNIQUE from channels.name...");

db.transaction(() => {
  // 1. Create a temporary table with the correct schema
  db.exec(`
        CREATE TABLE channels_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER,
            category_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'text',
            position INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            message_count INTEGER DEFAULT 0,
            FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    `);

  // 2. Copy data from the old table to the new one
  db.exec(`
        INSERT INTO channels_new (id, server_id, category_id, name, description, type, position, created_at, message_count)
        SELECT id, server_id, category_id, name, description, type, position, created_at, message_count FROM channels
    `);

  // 3. Drop the old table
  db.exec("DROP TABLE channels");

  // 4. Rename the new table to the old name
  db.exec("ALTER TABLE channels_new RENAME TO channels");
})();

console.log("Migration completed successfully.");
db.close();
