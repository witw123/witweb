from typing import Optional
from pathlib import Path
import os
import threading

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
try:
    from . import auth, blog, core, db
except ImportError:
    import auth
    import blog
    import core
    import db
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Sora2 Web Studio")

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
STATIC_DIR = ROOT_DIR / "frontend" / "dist"
ASSETS_DIR = STATIC_DIR / "assets"
STUDIO_DIR = ROOT_DIR / "frontend" / "studio"
DOWNLOADS_DIR = BACKEND_DIR / "downloads"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
if STUDIO_DIR.exists():
    app.mount("/studio", StaticFiles(directory=str(STUDIO_DIR), html=True), name="studio")
if DOWNLOADS_DIR.exists():
    app.mount("/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")

ADMIN_USERNAME = "witw"
ADMIN_PASSWORD = "witw"

@app.on_event("startup")
def on_startup():
    db.init_db(ADMIN_USERNAME, ADMIN_PASSWORD)

@app.get("/")
def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {
        "ok": False,
        "error": "frontend_not_built",
        "hint": "run `npm install` then `npm run build` in frontend/",
    }

@app.get("/studio")
def studio_root():
    index_file = STUDIO_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Not Found")

class GenReq(BaseModel):
    prompt: str
    duration: int = 15
    url: Optional[str] = None
    aspectRatio: Optional[str] = None
    size: Optional[str] = None
    remixTargetId: Optional[str] = None

class FinalizeReq(BaseModel):
    id: str
    prompt: str

class HostReq(BaseModel):
    host_mode: str

class ResultReq(BaseModel):
    id: str

class UploadCharacterReq(BaseModel):
    url: Optional[str] = None
    timestamps: str
    webHook: Optional[str] = "-1"
    shutProgress: Optional[bool] = None

class CreateCharacterReq(BaseModel):
    pid: str
    timestamps: str
    webHook: Optional[str] = "-1"
    shutProgress: Optional[bool] = None

class ApiKeyReq(BaseModel):
    api_key: str

class TokenReq(BaseModel):
    token: str

class QueryDefaultsReq(BaseModel):
    data: dict

class CreateApiKeyReq(BaseModel):
    token: str
    type: int = 0
    name: Optional[str] = ""
    credits: Optional[int] = 0
    expireTime: Optional[int] = 0

class ApiKeyCreditsReq(BaseModel):
    apiKey: str

class CreditsReq(BaseModel):
    token: str

class ModelStatusReq(BaseModel):
    model: str

class ActiveTaskRemoveReq(BaseModel):
    id: str

class VideoDeleteReq(BaseModel):
    name: str

class LoginReq(BaseModel):
    username: str
    password: str

class RegisterReq(BaseModel):
    username: str
    password: str
    nickname: str = ""
    avatar_url: str = ""

class PostReq(BaseModel):
    title: str
    slug: Optional[str] = None
    content: str
    tags: Optional[str] = ""

class CommentReq(BaseModel):
    content: str
    author: Optional[str] = None
    parent_id: Optional[int] = None

class ProfileReq(BaseModel):
    nickname: str = ""
    avatar_url: str = ""

@app.post("/api/login")
def login(req: LoginReq):
    if auth.authenticate_user(req.username, req.password):
        profile = auth.get_user_profile(req.username)
        return {"token": auth.create_token(req.username), "profile": profile}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/register")
def register(req: RegisterReq):
    if not req.username or not req.password:
        raise HTTPException(status_code=400, detail="Missing credentials")
    nickname = req.nickname or req.username
    created = auth.create_user(req.username, req.password, nickname, req.avatar_url or "")
    if not created:
        raise HTTPException(status_code=409, detail="Username already exists")
    profile = auth.get_user_profile(req.username)
    return {"token": auth.create_token(req.username), "profile": profile}

@app.get("/api/blog")
def blog_list(
    request: Request,
    response: Response,
    page: int = 1,
    size: int = 5,
    q: Optional[str] = None,
    author: Optional[str] = None,
):
    data = blog.list_posts(page=page, size=size, q=q, author=author)
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

@app.get("/api/blog/{slug}")
def blog_detail(slug: str, authorization: Optional[str] = Header(None)):
    username = auth.optional_user(authorization)
    return blog.get_post(slug, username)

@app.post("/api/admin/post")
def admin_post(req: PostReq, user=Depends(auth.verify_token)):
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="Title and content required")
    blog.create_post(req.title, req.slug, req.content, user, req.tags or "")
    return {"ok": True, "user": user}

@app.delete("/api/admin/post/{slug}")
def admin_delete_post(slug: str, user=Depends(auth.verify_token)):
    blog.delete_post(slug, user, ADMIN_USERNAME)
    return {"ok": True}

@app.get("/api/blog/{slug}/comments")
def blog_comments(slug: str):
    return blog.list_comments(slug)

@app.post("/api/blog/{slug}/comment")
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
    return {"ok": True}

@app.post("/api/blog/{slug}/like")
def blog_like(slug: str, user=Depends(auth.verify_token)):
    liked = blog.toggle_like(slug, user)
    return {"ok": True, "liked": liked}

@app.post("/api/blog/{slug}/dislike")
def blog_dislike(slug: str, user=Depends(auth.verify_token)):
    disliked = blog.toggle_dislike(slug, user)
    return {"ok": True, "disliked": disliked}

@app.post("/api/comment/{comment_id}/like")
def comment_like(comment_id: int, user=Depends(auth.verify_token)):
    blog.vote_comment(comment_id, user, 1)
    return {"ok": True}

@app.post("/api/comment/{comment_id}/dislike")
def comment_dislike(comment_id: int, user=Depends(auth.verify_token)):
    blog.vote_comment(comment_id, user, -1)
    return {"ok": True}

@app.post("/api/profile")
def update_profile(req: ProfileReq, user=Depends(auth.verify_token)):
    nickname = req.nickname or user
    avatar_url = req.avatar_url or ""
    profile = auth.update_profile(user, nickname, avatar_url)
    return {"ok": True, "profile": profile}

@app.post("/config/api-key")
def set_key(req: ApiKeyReq):
    core.set_api_key(req.api_key)
    return {"ok": True}

@app.post("/config/token")
def set_token(req: TokenReq):
    core.set_token(req.token)
    return {"ok": True}

@app.post("/config/query-defaults")
def set_query_defaults(req: QueryDefaultsReq):
    core.set_query_defaults(req.data)
    return {"ok": True}

@app.post("/config/host-mode")
def set_host_mode(req: HostReq):
    core.set_host_mode(req.host_mode)
    return {"ok": True}

@app.get("/config")
def get_config():
    return core.get_config()

@app.post("/generate")
def generate(req: GenReq):
    return core.generate_video(
        prompt=req.prompt,
        duration=req.duration,
        url=req.url,
        aspectRatio=req.aspectRatio,
        size=req.size,
        remixTargetId=req.remixTargetId,
    )

@app.post("/generate/start")
def generate_start(req: GenReq):
    task_id = core.create_video_task(
        prompt=req.prompt,
        duration=req.duration,
        url=req.url,
        aspectRatio=req.aspectRatio,
        size=req.size,
        remixTargetId=req.remixTargetId,
    )
    core.add_active_task(task_id, req.prompt)
    return {"id": task_id}

@app.post("/generate/finalize")
def generate_finalize(req: FinalizeReq):
    return core.finalize_video(req.id, req.prompt)

@app.post("/character/upload")
def upload_character(req: UploadCharacterReq):
    return core.upload_character(
        req.url,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )

@app.post("/character/create")
def create_character(req: CreateCharacterReq):
    return core.create_character(
        req.pid,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )

@app.post("/character/upload/start")
def upload_character_start(req: UploadCharacterReq):
    task_id = core.upload_character_task(
        req.url,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )
    return {"id": task_id}

@app.post("/character/create/start")
def create_character_start(req: CreateCharacterReq):
    task_id = core.create_character_task(
        req.pid,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )
    return {"id": task_id}

@app.post("/result")
def result(req: ResultReq):
    return core.get_result(req.id)

@app.post("/openapi/create-api-key")
def create_api_key(req: CreateApiKeyReq):
    return core.create_api_key(
        token=req.token,
        type=req.type,
        name=req.name or "",
        credits=req.credits or 0,
        expireTime=req.expireTime or 0,
    )

@app.post("/openapi/api-key-credits")
def api_key_credits(req: ApiKeyCreditsReq):
    return core.get_api_key_credits(req.apiKey)

@app.post("/openapi/credits")
def credits(req: CreditsReq):
    return core.get_credits(req.token)

@app.get("/credits")
def credits_from_config():
    token = core.get_saved_token()
    if not token:
        return {"credits": None, "error": "missing token"}
    try:
        return core.get_credits(token)
    except Exception as exc:
        return {"credits": None, "error": str(exc)}

@app.post("/model-status")
def model_status(req: ModelStatusReq):
    return core.get_model_status(req.model)

@app.get("/history")
def history():
    return core.get_history()

@app.get("/tasks/active")
def active_tasks():
    return core.get_active_tasks()

@app.post("/tasks/active/remove")
def active_tasks_remove(req: ActiveTaskRemoveReq):
    core.remove_active_task(req.id)
    return {"ok": True}

@app.get("/prompt-history")
def prompt_history():
    return []

@app.get("/videos")
def videos():
    return core.get_local_videos()

@app.post("/videos/delete")
def videos_delete(req: VideoDeleteReq):
    core.delete_video(req.name)
    return {"ok": True}

@app.post("/shutdown")
def shutdown(request: Request):
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="Forbidden")
    def _exit():
        os._exit(0)
    threading.Timer(0.2, _exit).start()
    return {"ok": True}

@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith(("api", "static", "assets", "downloads", "studio")):
        raise HTTPException(status_code=404, detail="Not Found")
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
