from datetime import datetime, timezone
import re

from fastapi import HTTPException
from ipaddress import ip_address

try:
    from .db import get_conn
except ImportError:
    from db import get_conn


def list_posts() -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT
          p.title,
          p.slug,
          p.content,
          p.created_at,
          p.author,
          p.tags,
          COALESCE(u.nickname, p.author) AS author_name,
          COALESCE(u.avatar_url, '') AS author_avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
        FROM posts p
        LEFT JOIN users u ON u.username = p.author
        ORDER BY p.id DESC
        """
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_post(slug: str, username: str | None = None) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute(
        """
        SELECT
          p.id,
          p.title,
          p.slug,
          p.content,
          p.created_at,
          p.author,
          p.tags,
          COALESCE(u.nickname, p.author) AS author_name,
          COALESCE(u.avatar_url, '') AS author_avatar,
          (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id) AS dislike_count,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
        FROM posts p
        LEFT JOIN users u ON u.username = p.author
        WHERE p.slug = ?
        """,
        (slug,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Post not found")
    data = dict(row)
    if username:
        conn = get_conn()
        cur = conn.cursor()
        liked = cur.execute(
            "SELECT id FROM likes WHERE post_id = ? AND username = ?",
            (data["id"], username),
        ).fetchone()
        conn.close()
        data["liked_by_me"] = liked is not None
    return data


def create_post(title: str, slug: str | None, content: str, author: str, tags: str = "") -> None:
    conn = get_conn()
    cur = conn.cursor()
    final_slug = _ensure_unique_slug(cur, slug or _slugify(title))
    cur.execute(
        "INSERT INTO posts (title, slug, content, created_at, author, tags) VALUES (?, ?, ?, ?, ?, ?)",
        (
            title,
            final_slug,
            content,
            datetime.now(timezone.utc).isoformat(),
            author,
            tags,
        ),
    )
    conn.commit()
    conn.close()


def delete_post(slug: str, username: str, admin_username: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute(
        "SELECT id, author FROM posts WHERE slug = ?",
        (slug,),
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    if username != row["author"] and username != admin_username:
        conn.close()
        raise HTTPException(status_code=403, detail="Forbidden")
    post_id = row["id"]
    cur.execute(
        "DELETE FROM comment_votes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)",
        (post_id,),
    )
    cur.execute("DELETE FROM comments WHERE post_id = ?", (post_id,))
    cur.execute("DELETE FROM likes WHERE post_id = ?", (post_id,))
    cur.execute("DELETE FROM dislikes WHERE post_id = ?", (post_id,))
    cur.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    conn.commit()
    conn.close()


def _slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    if not value:
        return f"post-{int(datetime.now(timezone.utc).timestamp())}"
    return value


def _ensure_unique_slug(cur, base_slug: str) -> str:
    base_slug = base_slug or f"post-{int(datetime.now(timezone.utc).timestamp())}"
    slug = base_slug
    suffix = 2
    while cur.execute("SELECT id FROM posts WHERE slug = ?", (slug,)).fetchone():
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    return slug


def list_comments(slug: str) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT id FROM posts WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    rows = cur.execute(
        """
        SELECT
          c.id,
          c.author,
          c.content,
          c.created_at,
          c.parent_id,
          c.ip_address,
          COALESCE(u.nickname, c.author) AS author_name,
          COALESCE(u.avatar_url, '') AS author_avatar,
          (SELECT COALESCE(SUM(v.value), 0) FROM comment_votes v WHERE v.comment_id = c.id) AS score,
          (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS like_count,
          (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS dislike_count
        FROM comments c
        LEFT JOIN users u ON u.username = c.author
        WHERE c.post_id = ?
        ORDER BY c.id DESC
        """,
        (row["id"],),
    ).fetchall()
    conn.close()
    results = []
    for r in rows:
        item = dict(r)
        item["ip_location"] = _ip_location(item.get("ip_address"))
        results.append(item)
    return results


def add_comment(slug: str, author: str, content: str, parent_id: int | None, ip_address: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT id FROM posts WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    cur.execute(
        "INSERT INTO comments (post_id, author, content, created_at, parent_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
        (row["id"], author, content, datetime.now(timezone.utc).isoformat(), parent_id, ip_address),
    )
    conn.commit()
    conn.close()


def toggle_like(slug: str, username: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT id FROM posts WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    existing = cur.execute(
        "SELECT id FROM likes WHERE post_id = ? AND username = ?",
        (row["id"], username),
    ).fetchone()
    if existing:
        cur.execute("DELETE FROM likes WHERE id = ?", (existing["id"],))
        conn.commit()
        conn.close()
        return False
    cur.execute(
        "INSERT INTO likes (post_id, username, created_at) VALUES (?, ?, ?)",
        (row["id"], username, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return True


def toggle_dislike(slug: str, username: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    row = cur.execute("SELECT id FROM posts WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    existing = cur.execute(
        "SELECT id FROM dislikes WHERE post_id = ? AND username = ?",
        (row["id"], username),
    ).fetchone()
    if existing:
        cur.execute("DELETE FROM dislikes WHERE id = ?", (existing["id"],))
        conn.commit()
        conn.close()
        return False
    cur.execute(
        "INSERT INTO dislikes (post_id, username, created_at) VALUES (?, ?, ?)",
        (row["id"], username, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()
    return True


def vote_comment(comment_id: int, username: str, value: int) -> None:
    if value not in (1, -1):
        raise HTTPException(status_code=400, detail="Invalid vote value")
    conn = get_conn()
    cur = conn.cursor()
    existing = cur.execute(
        "SELECT id FROM comment_votes WHERE comment_id = ? AND username = ?",
        (comment_id, username),
    ).fetchone()
    if existing:
        cur.execute(
            "UPDATE comment_votes SET value = ?, created_at = ? WHERE id = ?",
            (value, datetime.now(timezone.utc).isoformat(), existing["id"]),
        )
    else:
        cur.execute(
            "INSERT INTO comment_votes (comment_id, username, value, created_at) VALUES (?, ?, ?, ?)",
            (comment_id, username, value, datetime.now(timezone.utc).isoformat()),
        )
    conn.commit()
    conn.close()


def _ip_location(addr: str | None) -> str:
    if not addr:
        return "未知"
    try:
        ip_obj = ip_address(addr)
        if ip_obj.is_loopback:
            return "本地"
        if ip_obj.is_private:
            return "内网"
        return "公网"
    except ValueError:
        return "未知"
