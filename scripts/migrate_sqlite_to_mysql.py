import os
import sqlite3

import pymysql


def main() -> None:
    sqlite_path = os.getenv(
        "SQLITE_PATH",
        os.path.join(os.path.dirname(__file__), "..", "backend", "blog.db"),
    )
    mysql_host = os.getenv("MYSQL_HOST", "127.0.0.1")
    mysql_port = int(os.getenv("MYSQL_PORT", "3306"))
    mysql_user = os.getenv("MYSQL_USER", "sora2_user")
    mysql_password = os.getenv("MYSQL_PASSWORD", "")
    mysql_db = os.getenv("MYSQL_DB", "sora2_web")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    mysql_conn = pymysql.connect(
        host=mysql_host,
        port=mysql_port,
        user=mysql_user,
        password=mysql_password,
        database=mysql_db,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )
    mysql_cur = mysql_conn.cursor()

    tables = [
        "users",
        "posts",
        "likes",
        "dislikes",
        "comments",
        "comment_votes",
    ]

    for table in tables:
        sqlite_cur.execute(f"SELECT * FROM {table}")
        rows = sqlite_cur.fetchall()
        if not rows:
            continue
        columns = rows[0].keys()
        placeholders = ", ".join(["%s"] * len(columns))
        col_sql = ", ".join(columns)
        insert_sql = f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders})"
        for row in rows:
            mysql_cur.execute(insert_sql, tuple(row[col] for col in columns))

    mysql_conn.commit()
    mysql_conn.close()
    sqlite_conn.close()


if __name__ == "__main__":
    main()
