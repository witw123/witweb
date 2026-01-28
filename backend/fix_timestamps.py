"""
检查数据库状态并修复时间戳
"""
import sqlite3
from pathlib import Path

# 数据库路径
DB_PATH = Path(__file__).parent / "data" / "blog.db"

def check_and_fix():
    """检查数据库状态并修复"""
    if not DB_PATH.exists():
        print(f"❌ 数据库文件不存在: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    try:
        # 检查所有表
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cur.fetchall()]
        print(f"数据库中的表: {', '.join(tables)}")
        
        # 检查messages表是否存在
        if 'messages' not in tables:
            print("\n⚠️  messages表不存在")
            print("这是正常的，因为数据库刚创建时不包含讨论区功能")
            print("\n解决方案：重启后端服务器，会自动创建messages表")
            print("然后新发送的消息就会使用正确的本地时间")
            return
        
        # 如果messages表存在，检查是否有数据
        cur.execute("SELECT COUNT(*) FROM messages")
        count = cur.fetchone()[0]
        print(f"\nmessages表中有 {count} 条消息")
        
        if count == 0:
            print("✅ 没有需要迁移的数据，新消息将自动使用本地时间")
            return
        
        # 显示当前时间戳格式
        cur.execute("SELECT id, username, created_at FROM messages LIMIT 3")
        print("\n当前消息时间戳示例：")
        for row in cur.fetchall():
            print(f"  ID {row[0]} - {row[1]}: {row[2]}")
        
        # 执行迁移
        print("\n开始迁移...")
        
        # 1. 创建新表
        cur.execute("""
            CREATE TABLE messages_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                user_avatar TEXT,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (channel_id) REFERENCES channels(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # 2. 复制数据并转换时间
        cur.execute("""
            INSERT INTO messages_new (id, channel_id, user_id, username, user_avatar, content, created_at)
            SELECT 
                id, 
                channel_id, 
                user_id, 
                username, 
                user_avatar, 
                content,
                datetime(created_at, '+8 hours')
            FROM messages
        """)
        
        # 3. 删除旧表
        cur.execute("DROP TABLE messages")
        
        # 4. 重命名新表
        cur.execute("ALTER TABLE messages_new RENAME TO messages")
        
        conn.commit()
        
        # 验证
        cur.execute("SELECT id, username, created_at FROM messages LIMIT 3")
        print("\n✅ 迁移成功！新的时间戳示例：")
        for row in cur.fetchall():
            print(f"  ID {row[0]} - {row[1]}: {row[2]}")
            
    except Exception as e:
        print(f"\n❌ 错误：{e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    check_and_fix()
