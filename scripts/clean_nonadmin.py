#!/usr/bin/env python3
import subprocess
import sys

from backend import db
from config import ADMIN_USERNAME


def cleanup_non_admin():
    conn = db.get_conn()
    cur = conn.cursor()
    filters = [
        ("likes", "username <> ?"),
        ("dislikes", "username <> ?"),
        ("favorites", "username <> ?"),
        ("comment_votes", "username <> ?"),
        ("comments", "author <> ?"),
        ("posts", "author <> ?"),
        ("users", "username <> ?"),
    ]
    for table, clause in filters:
        cur.execute(f"DELETE FROM {table} WHERE {clause}", (ADMIN_USERNAME,))
    conn.commit()
    conn.close()


def restart_service(service="sora2"):
    try:
        subprocess.run(["systemctl", "restart", service], check=True)
    except FileNotFoundError:
        print("systemctl not found, please restart the service manually.", file=sys.stderr)
    except subprocess.CalledProcessError as exc:
        print(f"Failed to restart {service}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    cleanup_non_admin()
    restart_service()
