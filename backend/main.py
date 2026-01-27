from contextlib import asynccontextmanager
from pathlib import Path
import os
import threading
import time
import sys
import os

# Allow running as script (python backend/main.py)
if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "backend"

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

try:
    from .routers import auth as auth_router
    from .routers import blog as blog_router
    from .routers import studio as studio_router
    from . import db
    from .config import (
        ADMIN_USERNAME, ADMIN_PASSWORD,
        STATIC_DIR, ASSETS_DIR, STUDIO_DIR, DOWNLOADS_DIR, UPLOADS_DIR
    )
except ImportError:
    # Fallback for direct script execution
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from backend.routers import auth as auth_router
    from backend.routers import blog as blog_router
    from backend.routers import studio as studio_router
    from backend import db
    from backend.config import (
        ADMIN_USERNAME, ADMIN_PASSWORD,
        STATIC_DIR, ASSETS_DIR, STUDIO_DIR, DOWNLOADS_DIR, UPLOADS_DIR
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    db.init_db(ADMIN_USERNAME, ADMIN_PASSWORD)
    yield
    # Shutdown
    pass

app = FastAPI(title="Sora2 Web Studio", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=800)

# Mount Static Files
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
if STUDIO_DIR.exists():
    app.mount("/studio-static", StaticFiles(directory=str(STUDIO_DIR), html=True), name="studio")
if DOWNLOADS_DIR.exists():
    app.mount("/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")
if UPLOADS_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include Routers
app.include_router(auth_router.router)
app.include_router(blog_router.router)
app.include_router(studio_router.router)

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith(("/assets/", "/uploads/", "/static/", "/studio-static/")):
        response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
    elif path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    else:
        # Default for HTML/SPA routes: no-cache to ensure index.html is fresh
        response.headers.setdefault("Cache-Control", "no-cache, no-store, must-revalidate")
    return response

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
def studio_spa():
    # Return main frontend app for /studio route, letting React Router handle it
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return FileResponse(str(STUDIO_DIR / "index.html")) # Fallback if frontend build missing

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

# For direct execution
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
