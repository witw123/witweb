from typing import Optional
import os
import threading

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
import core
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Sora2 Web Studio")
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/downloads", StaticFiles(directory="downloads"), name="downloads")

@app.get("/")
def root():
    return FileResponse("static/index.html")

class GenReq(BaseModel):
    prompt: str
    duration: int = 10
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
def shutdown():
    def _exit():
        os._exit(0)
    threading.Timer(0.2, _exit).start()
    return {"ok": True}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
