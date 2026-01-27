from fastapi import APIRouter
from .. import core
from ..schemas import (
    GenReq, FinalizeReq, HostReq, ResultReq, UploadCharacterReq, CreateCharacterReq,
    ApiKeyReq, TokenReq, QueryDefaultsReq, CreateApiKeyReq, ApiKeyCreditsReq,
    CreditsReq, ModelStatusReq, ActiveTaskRemoveReq, VideoDeleteReq
)

router = APIRouter(tags=["Studio"])

@router.post("/config/api-key")
def set_key(req: ApiKeyReq):
    core.set_api_key(req.api_key)
    return {"ok": True}

@router.post("/config/token")
def set_token(req: TokenReq):
    core.set_token(req.token)
    return {"ok": True}

@router.post("/config/query-defaults")
def set_query_defaults(req: QueryDefaultsReq):
    core.set_query_defaults(req.data)
    return {"ok": True}

@router.post("/config/host-mode")
def set_host_mode(req: HostReq):
    core.set_host_mode(req.host_mode)
    return {"ok": True}

@router.get("/config")
def get_config():
    return core.get_config()

@router.post("/generate")
def generate(req: GenReq):
    return core.generate_video(
        prompt=req.prompt,
        duration=req.duration,
        url=req.url,
        aspectRatio=req.aspectRatio,
        size=req.size,
        remixTargetId=req.remixTargetId,
    )

@router.post("/generate/start")
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

@router.post("/generate/finalize")
def generate_finalize(req: FinalizeReq):
    return core.finalize_video(req.id, req.prompt)

@router.post("/character/upload")
def upload_character(req: UploadCharacterReq):
    return core.upload_character(
        req.url,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )

@router.post("/character/create")
def create_character(req: CreateCharacterReq):
    return core.create_character(
        req.pid,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )

@router.post("/character/upload/start")
def upload_character_start(req: UploadCharacterReq):
    task_id = core.upload_character_task(
        req.url,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )
    return {"id": task_id}

@router.post("/character/create/start")
def create_character_start(req: CreateCharacterReq):
    task_id = core.create_character_task(
        req.pid,
        req.timestamps,
        webHook=req.webHook,
        shutProgress=req.shutProgress,
    )
    return {"id": task_id}

@router.post("/result")
def result(req: ResultReq):
    return core.get_result(req.id)

@router.post("/openapi/create-api-key")
def create_api_key(req: CreateApiKeyReq):
    return core.create_api_key(
        token=req.token,
        type=req.type,
        name=req.name or "",
        credits=req.credits or 0,
        expireTime=req.expireTime or 0,
    )

@router.post("/openapi/api-key-credits")
def api_key_credits(req: ApiKeyCreditsReq):
    return core.get_api_key_credits(req.apiKey)

@router.post("/openapi/credits")
def credits(req: CreditsReq):
    return core.get_credits(req.token)

@router.get("/credits")
def credits_from_config():
    token = core.get_saved_token()
    if not token:
        return {"credits": None, "error": "missing token"}
    try:
        return core.get_credits(token)
    except Exception as exc:
        return {"credits": None, "error": str(exc)}

@router.post("/model-status")
def model_status(req: ModelStatusReq):
    return core.get_model_status(req.model)

@router.get("/history")
def history():
    return core.get_history()

@router.get("/tasks/active")
def active_tasks():
    return core.get_active_tasks()

@router.post("/tasks/active/remove")
def active_tasks_remove(req: ActiveTaskRemoveReq):
    core.remove_active_task(req.id)
    return {"ok": True}

@router.get("/prompt-history")
def prompt_history():
    return []

@router.get("/videos")
def videos():
    return core.get_local_videos()

@router.post("/videos/delete")
def videos_delete(req: VideoDeleteReq):
    core.delete_video(req.name)
    return {"ok": True}
