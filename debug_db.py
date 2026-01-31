import sqlite3
import os

BASE_DIR = os.path.join("data")
USERS_DB = os.path.join(BASE_DIR, "users.db")
BLOG_DB = os.path.join(BASE_DIR, "blog.db")

def check_db():
    if not os.path.exists(USERS_DB):
        print(f"Error: {USERS_DB} not found")
        return
    
    print(f"--- Querying {USERS_DB} ---")
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username FROM users WHERE username = 'witw'")
        user = cursor.fetchone()
        print(f"User 'witw': {user}")
        conn.close()
    except Exception as e:
        print(f"Error reading users.db: {e}")

    print(f"\n--- Querying {BLOG_DB} ---")
    try:
        conn = sqlite3.connect(BLOG_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM posts")
        count = cursor.fetchone()[0]
        print(f"Total posts: {count}")
        
        cursor.execute("SELECT id, title, author, status FROM posts LIMIT 5")
        posts = cursor.fetchall()
        for p in posts:
            print(f"Post: {p}")
            
        cursor.execute("SELECT id, title FROM posts WHERE author = 'witw'")
        my_posts = cursor.fetchall()
        print(f"Posts by 'witw': {my_posts}")
        
        conn.close()
    except Exception as e:
        print(f"Error reading blog.db: {e}")

if __name__ == "__main__":
    check_db()
