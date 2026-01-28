"""
管理员统计数据API
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

try:
    from ..routers.auth import get_current_user
    from ..db import get_conn, adapt_query
except ImportError:
    from backend.routers.auth import get_current_user
    from backend.db import get_conn, adapt_query

router = APIRouter(prefix="/api/admin/stats", tags=["Admin Stats"])

# Pydantic模型
class StatsOverview(BaseModel):
    total_users: int
    total_blogs: int
    total_published_blogs: int
    total_draft_blogs: int
    total_channels: int
    total_messages: int

# 管理员权限检查
def require_admin(username: str = Depends(get_current_user)) -> str:
    """要求管理员权限"""
    if username != "witw":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username

# 获取系统概览统计
@router.get("/overview", response_model=StatsOverview)
def get_stats_overview(username: str = Depends(require_admin)):
    """获取系统概览统计（仅管理员）"""
    conn = get_conn()
    cur = conn.cursor()
    
    # 获取用户总数
    cur.execute(adapt_query("SELECT COUNT(*) FROM users"))
    total_users = cur.fetchone()[0]
    
    # 获取文章总数
    cur.execute(adapt_query("SELECT COUNT(*) FROM posts"))
    total_blogs = cur.fetchone()[0]
    
    # 获取已发布文章数（posts表没有status字段，全部视为已发布）
    cur.execute(adapt_query("SELECT COUNT(*) FROM posts"))
    total_published_blogs = cur.fetchone()[0]
    
    # 获取草稿文章数（posts表没有status字段，设为0）
    total_draft_blogs = 0
    
    # 获取频道总数
    cur.execute(adapt_query("SELECT COUNT(*) FROM channels"))
    total_channels = cur.fetchone()[0]
    
    # 获取消息总数
    cur.execute(adapt_query("SELECT COUNT(*) FROM messages"))
    total_messages = cur.fetchone()[0]
    
    conn.close()
    
    return {
        "total_users": total_users,
        "total_blogs": total_blogs,
        "total_published_blogs": total_published_blogs,
        "total_draft_blogs": total_draft_blogs,
        "total_channels": total_channels,
        "total_messages": total_messages
    }
