"""
管理员文章管理API
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List

try:
    from ..routers.auth import get_current_user
    from ..db import get_conn, adapt_query
except ImportError:
    from backend.routers.auth import get_current_user
    from backend.db import get_conn, adapt_query

router = APIRouter(prefix="/api/admin/blogs", tags=["Admin Blogs"])

# Pydantic模型
class BlogInfo(BaseModel):
    id: int
    username: str
    title: str
    status: str
    created_at: str
    updated_at: str

class BlogListResponse(BaseModel):
    blogs: List[BlogInfo]
    total: int
    page: int
    limit: int

class UpdateBlogRequest(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None

# 管理员权限检查
def require_admin(username: str = Depends(get_current_user)) -> str:
    """要求管理员权限"""
    if username != "witw":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username

# 获取所有文章列表
@router.get("", response_model=BlogListResponse)
def get_all_blogs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    username_filter: Optional[str] = Query(None, alias="username"),
    sort: str = "created_at_desc",
    admin_username: str = Depends(require_admin)
):
    """获取所有文章列表（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    offset = (page - 1) * limit
    
    # 构建查询条件
    where_clause = "WHERE 1=1"
    params = []
    
    if search:
        where_clause += " AND (title LIKE ? OR content LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    
    if status:
        where_clause += " AND status = ?"
        params.append(status)
    
    if username_filter:
        where_clause += " AND username = ?"
        params.append(username_filter)
    
    # 获取总数
    cur.execute(adapt_query(f"SELECT COUNT(*) FROM posts {where_clause}"), tuple(params))
    total = cur.fetchone()[0]
    
    # 排序
    order_by = "created_at DESC"
    if sort == "created_at_asc":
        order_by = "created_at ASC"
    elif sort == "updated_at_desc":
        order_by = "updated_at DESC"
    elif sort == "updated_at_asc":
        order_by = "updated_at ASC"
    elif sort == "title_asc":
        order_by = "title ASC"
    elif sort == "title_desc":
        order_by = "title DESC"
    
    # 获取文章列表
    cur.execute(adapt_query(f"""
        SELECT
            id,
            author as username,
            title,
            COALESCE(status, 'published') as status,
            created_at,
            COALESCE(updated_at, created_at) as updated_at
        FROM posts
        {where_clause}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """), tuple(params + [limit, offset]))
    
    blogs = []
    for row in cur.fetchall():
        blogs.append({
            "id": row[0],
            "username": row[1],
            "title": row[2],
            "status": row[3],
            "created_at": row[4],
            "updated_at": row[5]
        })
    
    conn.close()
    
    return {
        "blogs": blogs,
        "total": total,
        "page": page,
        "limit": limit
    }

# 获取文章详情
@router.get("/{blog_id}")
def get_blog_detail(
    blog_id: int,
    username: str = Depends(require_admin)
):
    """获取文章详情（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute(adapt_query("""
        SELECT
            id,
            author as username,
            title,
            content,
            COALESCE(status, 'published') as status,
            created_at,
            COALESCE(updated_at, created_at) as updated_at
        FROM posts WHERE id = ?
    """), (blog_id,))
    
    row = cur.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Blog not found")
    
    return {
        "id": row[0],
        "username": row[1],
        "title": row[2],
        "content": row[3],
        "status": row[4],
        "created_at": row[5],
        "updated_at": row[6]
    }

# 更新文章
@router.put("/{blog_id}")
def update_blog(
    blog_id: int,
    update_data: UpdateBlogRequest,
    username: str = Depends(require_admin)
):
    """更新文章（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    # 检查文章是否存在
    cur.execute(adapt_query("SELECT id FROM posts WHERE id = ?"), (blog_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Blog not found")
    
    # 构建更新语句
    update_fields = []
    params = []
    
    if update_data.status:
        update_fields.append("status = ?")
        params.append(update_data.status)
    
    if update_data.title:
        update_fields.append("title = ?")
        params.append(update_data.title)
    
    if update_data.content:
        update_fields.append("content = ?")
        params.append(update_data.content)
    
    if update_fields:
        update_fields.append("updated_at = datetime('now', 'localtime')")
        params.append(blog_id)
        
        cur.execute(adapt_query(f"""
            UPDATE posts
            SET {', '.join(update_fields)}
            WHERE id = ?
        """), tuple(params))
        
        conn.commit()
    
    conn.close()
    
    return {"ok": True, "message": "Blog updated successfully"}

# 删除文章
@router.delete("/{blog_id}")
def delete_blog(
    blog_id: int,
    username: str = Depends(require_admin)
):
    """删除文章（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    # 检查文章是否存在
    cur.execute(adapt_query("SELECT id FROM posts WHERE id = ?"), (blog_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Blog not found")
    
    # 删除文章
    cur.execute(adapt_query("DELETE FROM posts WHERE id = ?"), (blog_id,))
    
    conn.commit()
    conn.close()
    
    return {"ok": True, "message": "Blog deleted successfully"}
