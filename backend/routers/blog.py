from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse
from .. import blog, auth
from ..schemas import PostReq, UpdatePostReq, CommentReq, ProfileReq
from ..config import ADMIN_USERNAME, UPLOADS_DIR
import time
import threading
import uuid
from pathlib import Path

router = APIRouter(prefix="/api", tags=["Blog"])

_blog_cache = {}
_blog_cache_lock = threading.Lock()
_BLOG_CACHE_TTL = 10
_comments_cache = {}
_comments_cache_lock = threading.Lock()
_COMMENTS_CACHE_TTL = 10

def _clear_blog_cache() -> None:
    with _blog_cache_lock:
        _blog_cache.clear()

def _clear_comments_cache(slug: str | None) -> None:
    if not slug:
        return
    with _comments_cache_lock:
        _comments_cache.pop(slug, None)

def _safe_filename(filename: str) -> str:
    name = Path(filename).name
    return "".join(ch for ch in name if ch.isalnum() or ch in ("-", "_", ".", " "))

@router.get("/blog")
def blog_list(
    request: Request,
    response: Response,
    page: int = 1,
    size: int = 5,
    q: Optional[str] = None,
    author: Optional[str] = None,
    tag: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    username = auth.optional_user(authorization)
    cache_key = (page, size, q or "", author or "", tag or "", username or "")
    now = time.time()
    with _blog_cache_lock:
        cached = _blog_cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            data = cached["data"]
        else:
            data = None
    if data is None:
        data = blog.list_posts(
            page=page,
            size=size,
            query=q,
            author=author,
            tag=tag,
            username=username,
        )
        with _blog_cache_lock:
            _blog_cache[cache_key] = {
                "expires_at": now + _BLOG_CACHE_TTL,
                "data": data,
            }
    etag = data.get("etag")
    if etag:
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304)
        response.headers["ETag"] = etag
    return {
        "items": data.get("items", []),
        "total": data.get("total", 0),
        "page": data.get("page", page),
        "size": data.get("size", size),
    }

@router.get("/blog/{slug}")
def blog_detail(slug: str, authorization: Optional[str] = Header(None)):
    username = auth.optional_user(authorization)
    return blog.get_post(slug, username)

@router.post("/admin/post")
@router.post("/blog")
def admin_post(req: PostReq, user=Depends(auth.verify_token)):
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="Title and content required")
    blog.create_post(req.title, req.slug, req.content, user, req.tags or "")
    _clear_blog_cache()
    return {"ok": True, "user": user}

@router.put("/blog/{slug}")
def update_post(slug: str, req: UpdatePostReq, user=Depends(auth.verify_token)):
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="Title and content required")
    blog.update_post(slug, req.title, req.content, req.tags or "", user)
    _clear_blog_cache()
    return {"ok": True}

@router.delete("/admin/post/{slug}")
@router.delete("/blog/{slug}")
def admin_delete_post(slug: str, user=Depends(auth.verify_token)):
    blog.delete_post(slug, user, ADMIN_USERNAME)
    _clear_blog_cache()
    return {"ok": True}

@router.get("/blog/{slug}/comments")
@router.get("/blog/{slug}/comment")
def blog_comments(slug: str):
    now = time.time()
    with _comments_cache_lock:
        cached = _comments_cache.get(slug)
        if cached and cached["expires_at"] > now:
            return cached["data"]
    data = blog.list_comments(slug)
    with _comments_cache_lock:
        _comments_cache[slug] = {
            "expires_at": now + _COMMENTS_CACHE_TTL,
            "data": data,
        }
    return data

@router.post("/blog/{slug}/comments")
@router.post("/blog/{slug}/comment")
def blog_comment(
    slug: str,
    req: CommentReq,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    username = auth.optional_user(authorization)
    author = username or (req.author or "访客")
    client_ip = request.client.host if request.client else ""
    blog.add_comment(slug, author, req.content, req.parent_id, client_ip)
    _clear_blog_cache()
    _clear_comments_cache(slug)
    return {"ok": True}

@router.post("/blog/{slug}/like")
def blog_like(slug: str, user=Depends(auth.verify_token)):
    liked = blog.toggle_like(slug, user)
    _clear_blog_cache()
    counts = blog.get_post_counts(slug)
    return {"ok": True, "liked": liked, **counts}

@router.post("/blog/{slug}/dislike")
def blog_dislike(slug: str, user=Depends(auth.verify_token)):
    disliked = blog.toggle_dislike(slug, user)
    _clear_blog_cache()
    counts = blog.get_post_counts(slug)
    return {"ok": True, "disliked": disliked, **counts}

@router.post("/blog/{slug}/favorite")
def blog_favorite(slug: str, user=Depends(auth.verify_token)):
    favorited = blog.toggle_favorite(slug, user)
    _clear_blog_cache()
    counts = blog.get_post_counts(slug)
    return {"ok": True, "favorited": favorited, **counts}

@router.get("/favorites")
def favorites_list(user=Depends(auth.verify_token), page: int = 1, size: int = 10):
    return blog.list_favorites(page=page, size=size, username=user)

@router.post("/comment/{comment_id}/like")
def comment_like(comment_id: int, user=Depends(auth.verify_token)):
    blog.vote_comment(comment_id, user, 1)
    slug = blog.get_post_slug_for_comment(comment_id)
    _clear_comments_cache(slug)
    return {"ok": True}

@router.post("/comment/{comment_id}/dislike")
def comment_dislike(comment_id: int, user=Depends(auth.verify_token)):
    blog.vote_comment(comment_id, user, -1)
    slug = blog.get_post_slug_for_comment(comment_id)
    _clear_comments_cache(slug)
    return {"ok": True}

@router.post("/upload-image")
@router.post("/upload")
def upload_image(file: UploadFile = File(...), user=Depends(auth.verify_token)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file")
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    safe_name = _safe_filename(file.filename)
    ext = Path(safe_name).suffix or ".png"
    unique_name = f"{int(time.time())}-{uuid.uuid4().hex}{ext}"
    target = UPLOADS_DIR / unique_name
    with target.open("wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    return {"ok": True, "url": f"/uploads/{unique_name}"}

@router.get("/thumbnail")
def get_thumbnail(url: str, width: int = 300):
    """
    Generates a thumbnail for the given local upload URL.
    Example: /api/thumbnail?url=/uploads/foo.png&width=200
    """
    if not url.startswith("/uploads/"):
        return Response(status_code=404)
    
    filename = url.replace("/uploads/", "")
    original_path = UPLOADS_DIR / filename
    
    if not original_path.exists():
        return Response(status_code=404)
        
    # Check for cache
    thumb_dir = UPLOADS_DIR / "thumbnails"
    thumb_dir.mkdir(exist_ok=True)
    thumb_filename = f"{width}_{filename}"
    thumb_path = thumb_dir / thumb_filename
    
    if thumb_path.exists():
        return FileResponse(thumb_path)
    
    # Generate thumbnail
    try:
        from PIL import Image
        with Image.open(original_path) as img:
            # Convert to RGB if needed
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            w, h = img.size
            ratio = width / float(w)
            new_height = int(h * ratio)
            
            img.thumbnail((width, new_height))
            img.save(thumb_path, "JPEG", quality=85)
            
        return FileResponse(thumb_path)
    except Exception as e:
        print(f"Thumbnail error: {e}")
        # Fallback to original if processing fails
        return FileResponse(original_path)
