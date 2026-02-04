const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'blog.db');
const sqlPath = path.join(__dirname, '..', '..', 'data', 'migrations', 'add_visit_tracking.sql');

const db = new Database(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

try {
  db.exec(sql);
  console.log('✅ Visit tracking tables created successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

db.close();
