"""
添加balance字段到现有users表
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "blog.db"

def add_balance_field():
    """为users表添加balance字段"""
    if not DB_PATH.exists():
        print(f"❌ 数据库文件不存在: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    try:
        # 检查balance字段是否已存在
        cur.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cur.fetchall()]
        
        if 'balance' in columns:
            print("✅ balance字段已存在，无需添加")
            return
        
        print("开始添加balance字段...")
        
        # 添加balance字段
        cur.execute("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0.0")
        
        # 为所有现有用户设置默认余额
        cur.execute("UPDATE users SET balance = 0.0 WHERE balance IS NULL")
        
        conn.commit()
        
        # 验证
        cur.execute("SELECT username, balance FROM users")
        users = cur.fetchall()
        
        print(f"\n✅ 成功添加balance字段！")
        print(f"当前用户余额：")
        for user in users:
            print(f"  - {user[0]}: ¥{user[1]:.2f}")
            
    except Exception as e:
        print(f"\n❌ 错误：{e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_balance_field()
