import sqlite3
import os

db_path = 'data/blog.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
with open('schema.txt', 'w', encoding='utf-8') as f:
    for row in cursor.fetchall():
        f.write(row[0] + "\n")
conn.close()
