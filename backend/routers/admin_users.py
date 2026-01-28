"""
管理员用户管理API
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

try:
    from ..routers.auth import get_current_user
    from ..db import get_conn, adapt_query
except ImportError:
    from backend.routers.auth import get_current_user
    from backend.db import get_conn, adapt_query

router = APIRouter(prefix="/api/admin/users", tags=["Admin Users"])

# Pydantic模型
class UserInfo(BaseModel):
    username: str
    created_at: str
    status: Optional[str] = "active"
    last_login: Optional[str] = None

class UserListResponse(BaseModel):
    users: List[UserInfo]
    total: int
    page: int
    limit: int

class UpdateUserRequest(BaseModel):
    status: Optional[str] = None

# 管理员权限检查
def require_admin(username: str = Depends(get_current_user)) -> str:
    """要求管理员权限"""
    if username != "witw":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username

# 获取用户列表
@router.get("", response_model=UserListResponse)
def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sort: str = "created_at_desc",
    username: str = Depends(require_admin)
):
    """获取用户列表（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    offset = (page - 1) * limit
    
    # 构建查询条件
    where_clause = "WHERE 1=1"
    params = []
    
    if search:
        where_clause += " AND username LIKE ?"
        params.append(f"%{search}%")
    
    # 获取总数
    cur.execute(adapt_query(f"SELECT COUNT(*) FROM users {where_clause}"), tuple(params))
    total = cur.fetchone()[0]
    
    # 排序
    order_by = "created_at DESC"
    if sort == "created_at_asc":
        order_by = "created_at ASC"
    elif sort == "username_asc":
        order_by = "username ASC"
    elif sort == "username_desc":
        order_by = "username DESC"
    
    # 获取用户列表
    cur.execute(adapt_query(f"""
        SELECT username, created_at
        FROM users
        {where_clause}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """), tuple(params + [limit, offset]))
    
    users = []
    for row in cur.fetchall():
        users.append({
            "username": row[0],
            "created_at": row[1] if row[1] else "",
            "status": "active",  # 默认值
            "last_login": None
        })
    
    conn.close()
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "limit": limit
    }

# 获取用户详情
@router.get("/{target_username}")
def get_user_detail(
    target_username: str,
    username: str = Depends(require_admin)
):
    """获取用户详情（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(adapt_query("SELECT username, created_at FROM users WHERE username = ?"), (target_username,))
    row = cur.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    # 获取用户的文章数量
    cur.execute(adapt_query("SELECT COUNT(*) FROM posts WHERE author = ?"), (target_username,))
    blog_count = cur.fetchone()[0]
    
    conn.close()
    
    return {
        "username": row[0],
        "created_at": row[1] if row[1] else "",
        "status": "active",
        "last_login": None,
        "blog_count": blog_count
    }

# 更新用户信息
@router.put("/{target_username}")
def update_user(
    target_username: str,
    update_data: UpdateUserRequest,
    username: str = Depends(require_admin)
):
    """更新用户信息（仅管理员）"""
    if target_username == "witw":
        raise HTTPException(status_code=403, detail="Cannot modify admin user")
    
    conn = get_conn()
    cur = conn.cursor()
    
    # 检查用户是否存在
    cur.execute(adapt_query("SELECT username FROM users WHERE username = ?"), (target_username,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    conn.close()
    
    return {"ok": True, "message": "User verified"}

# 删除用户
@router.delete("/{target_username}")
def delete_user(
    target_username: str,
    username: str = Depends(require_admin)
):
    """删除用户（仅管理员）"""
    if target_username == "witw":
        raise HTTPException(status_code=403, detail="Cannot delete admin user")
    
    conn = get_conn()
    cur = conn.cursor()
    
    # 检查用户是否存在
    cur.execute(adapt_query("SELECT username FROM users WHERE username = ?"), (target_username,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    # 删除用户的文章
    cur.execute(adapt_query("DELETE FROM posts WHERE author = ?"), (target_username,))
    
    # 删除用户
    cur.execute(adapt_query("DELETE FROM users WHERE username = ?"), (target_username,))
    
    conn.commit()
    conn.close()
    
    return {"ok": True, "message": "User deleted successfully"}
