from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime

try:
    from ..db import get_conn
    from ..routers.auth import get_current_user
except ImportError:
    from backend.db import get_conn
    from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/channels", tags=["channels"])

# Pydantic Models
class ChannelResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: str
    message_count: int

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    channel_id: int
    user_id: int
    username: str
    user_avatar: Optional[str]
    content: str
    created_at: str

# Get all channels
@router.get("", response_model=List[ChannelResponse])
def get_channels():
    """Get list of all channels"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, description, created_at, message_count
        FROM channels
        ORDER BY id ASC
    """)
    
    channels = []
    for row in cur.fetchall():
        channels.append({
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "created_at": row[3],
            "message_count": row[4]
        })
    
    conn.close()
    return channels

# Get channel by ID
@router.get("/{channel_id}", response_model=ChannelResponse)
def get_channel(channel_id: int):
    """Get channel details by ID"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, description, created_at, message_count
        FROM channels
        WHERE id = ?
    """, (channel_id,))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": row[3],
        "message_count": row[4]
    }

# Get messages in a channel
@router.get("/{channel_id}/messages", response_model=List[MessageResponse])
def get_messages(channel_id: int, page: int = 1, page_size: int = 50):
    """Get messages in a channel with pagination"""
    conn = get_conn()
    cur = conn.cursor()
    
    # Verify channel exists
    cur.execute("SELECT id FROM channels WHERE id = ?", (channel_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Channel not found")
    
    offset = (page - 1) * page_size
    
    cur.execute("""
        SELECT id, channel_id, user_id, username, user_avatar, content, created_at
        FROM messages
        WHERE channel_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, (channel_id, page_size, offset))
    
    messages = []
    for row in cur.fetchall():
        messages.append({
            "id": row[0],
            "channel_id": row[1],
            "user_id": row[2],
            "username": row[3],
            "user_avatar": row[4],
            "content": row[5],
            "created_at": row[6]
        })
    
    conn.close()
    return messages

# Post a message to a channel
@router.post("/{channel_id}/messages", response_model=MessageResponse)
def post_message(channel_id: int, message: MessageCreate, username: str = Depends(get_current_user)):
    """Post a new message to a channel (requires authentication)"""
    conn = get_conn()
    cur = conn.cursor()
    
    # Verify channel exists
    cur.execute("SELECT id FROM channels WHERE id = ?", (channel_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get user details
    cur.execute("SELECT id, username, nickname, avatar_url FROM users WHERE username = ?", (username,))
    user_row = cur.fetchone()
    
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = user_row[0]
    user_username = user_row[1]
    nickname = user_row[2] or user_username
    avatar_url = user_row[3]
    
    # Insert message
    cur.execute("""
        INSERT INTO messages (channel_id, user_id, username, user_avatar, content)
        VALUES (?, ?, ?, ?, ?)
    """, (channel_id, user_id, nickname, avatar_url, message.content))
    
    message_id = cur.lastrowid
    
    # Update channel message count
    cur.execute("""
        UPDATE channels
        SET message_count = message_count + 1
        WHERE id = ?
    """, (channel_id,))
    
    conn.commit()
    
    # Get the created message
    cur.execute("""
        SELECT id, channel_id, user_id, username, user_avatar, content, created_at
        FROM messages
        WHERE id = ?
    """, (message_id,))
    
    row = cur.fetchone()
    conn.close()
    
    return {
        "id": row[0],
        "channel_id": row[1],
        "user_id": row[2],
        "username": row[3],
        "user_avatar": row[4],
        "content": row[5],
        "created_at": row[6]
    }

# Delete a message (author or admin only)
@router.delete("/messages/{message_id}")
def delete_message(message_id: int, username: str = Depends(get_current_user)):
    """Delete a message (author or admin only)"""
    conn = get_conn()
    cur = conn.cursor()
    
    # Get message details
    cur.execute("""
        SELECT channel_id, user_id, username
        FROM messages
        WHERE id = ?
    """, (message_id,))
    
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Message not found")
    
    channel_id, message_user_id, message_username = row
    
    # Check if user is author or admin
    cur.execute("SELECT username FROM users WHERE id = ?", (message_user_id,))
    author_row = cur.fetchone()
    
    if username != "witw" and username != (author_row[0] if author_row else None):
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    
    # Delete message
    cur.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    
    # Update channel message count
    cur.execute("""
        UPDATE channels
        SET message_count = message_count - 1
        WHERE id = ?
    """, (channel_id,))
    
    conn.commit()
    conn.close()
    
    return {"ok": True, "message": "Message deleted"}
