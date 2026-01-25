import os
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException
from jose import JWTError, jwt
from passlib.hash import bcrypt

try:
    from .db import get_conn, adapt_query
except ImportError:
    from db import get_conn, adapt_query

q = adapt_query

SECRET_KEY = os.getenv("BLOG_SECRET", "change-this-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub") or ""
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def authenticate_user(username: str, password: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        q("SELECT password FROM users WHERE username = ?"), (username,)
    )
    row = cur.fetchone()
    conn.close()
    if row is None:
        return False
    return bcrypt.verify(password, row["password"])


def get_user_profile(username: str) -> dict | None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        q("SELECT username, nickname, avatar_url FROM users WHERE username = ?"),
        (username,),
    )
    row = cur.fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "username": row["username"],
        "nickname": row["nickname"] or row["username"],
        "avatar_url": row["avatar_url"] or "",
    }


def optional_user(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def create_user(username: str, password: str, nickname: str, avatar_url: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        q("SELECT id FROM users WHERE username = ?"), (username,)
    )
    existing = cur.fetchone()
    if existing is not None:
        conn.close()
        return False
    cur.execute(
        q("INSERT INTO users (username, password, nickname, avatar_url) VALUES (?, ?, ?, ?)"),
        (username, bcrypt.hash(password), nickname, avatar_url),
    )
    conn.commit()
    conn.close()
    return True


def update_profile(username: str, nickname: str, avatar_url: str) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        q("UPDATE users SET nickname = ?, avatar_url = ? WHERE username = ?"),
        (nickname, avatar_url, username),
    )
    conn.commit()
    conn.close()
    return get_user_profile(username) or {}
