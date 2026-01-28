"""
视频API路由
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List

try:
    from ..routers.auth import get_current_user
    from ..services.sora2_client import sora2_client
    from ..services.video_service import video_service
except ImportError:
    from backend.routers.auth import get_current_user
    from backend.services.sora2_client import sora2_client
    from backend.services.video_service import video_service

router = APIRouter(prefix="/api/video", tags=["Video"])

# Pydantic模型
class GenerateVideoRequest(BaseModel):
    prompt: str
    model: str = "sora-2"
    url: Optional[str] = None
    aspectRatio: str = "9:16"
    duration: int = 10
    remixTargetId: str = ""
    size: str = "small"

class UploadCharacterRequest(BaseModel):
    url: str
    timestamps: str = "0,3"

class CreateCharacterRequest(BaseModel):
    pid: str
    timestamps: str = "0,3"

# 生成视频
@router.post("/generate")
def generate_video(
    request: GenerateVideoRequest,
    username: str = Depends(get_current_user)
):
    """生成视频"""
    try:
        # 调用Sora2 API
        result = sora2_client.generate_video(
            prompt=request.prompt,
            model=request.model,
            url=request.url,
            aspect_ratio=request.aspectRatio,
            duration=request.duration,
            remix_target_id=request.remixTargetId,
            size=request.size
        )
        
        task_id = result.get('id')
        if not task_id:
            raise HTTPException(status_code=500, detail="Failed to get task ID from API")
        
        # 创建任务记录
        video_service.create_task(
            username=username,
            task_type='generate',
            task_id=task_id,
            prompt=request.prompt,
            model=request.model,
            url=request.url,
            aspect_ratio=request.aspectRatio,
            duration=request.duration,
            remix_target_id=request.remixTargetId,
            size=request.size
        )
        
        # 使用API返回的ID覆盖
        video_service.update_task_status(task_id, 'running', 0)
        
        return {"ok": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 上传角色
@router.post("/upload-character")
def upload_character(
    request: UploadCharacterRequest,
    username: str = Depends(get_current_user)
):
    """上传角色"""
    try:
        result = sora2_client.upload_character(
            url=request.url,
            timestamps=request.timestamps
        )
        
        task_id = result.get('id')
        if not task_id:
            raise HTTPException(status_code=500, detail="Failed to get task ID from API")
        
        video_service.create_task(
            username=username,
            task_type='upload_character',
            task_id=task_id,
            url=request.url,
            timestamps=request.timestamps
        )
        
        video_service.update_task_status(task_id, 'running', 0)
        
        return {"ok": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 创建角色
@router.post("/create-character")
def create_character(
    request: CreateCharacterRequest,
    username: str = Depends(get_current_user)
):
    """从原视频创建角色"""
    try:
        result = sora2_client.create_character(
            pid=request.pid,
            timestamps=request.timestamps
        )
        
        task_id = result.get('id')
        if not task_id:
            raise HTTPException(status_code=500, detail="Failed to get task ID from API")
        
        video_service.create_task(
            username=username,
            task_type='create_character',
            task_id=task_id,
            pid=request.pid,
            timestamps=request.timestamps
        )
        
        video_service.update_task_status(task_id, 'running', 0)
        
        return {"ok": True, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取任务列表
@router.get("/tasks")
def get_tasks(
    page: int = 1,
    limit: int = 20,
    task_type: Optional[str] = None,
    username: str = Depends(get_current_user)
):
    """获取任务列表"""
    try:
        return video_service.get_tasks(username, page, limit, task_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取任务详情
@router.get("/tasks/{task_id}")
def get_task(
    task_id: str,
    username: str = Depends(get_current_user)
):
    """获取任务详情"""
    try:
        # 先从数据库获取
        task = video_service.get_task(task_id, username)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # 如果任务还在进行中，轮询更新状态
        if task['status'] in ['pending', 'running']:
            try:
                video_service.poll_and_update(task_id)
                # 重新获取更新后的任务
                task = video_service.get_task(task_id, username)
            except Exception as e:
                # 轮询失败不影响返回现有数据
                print(f"Poll failed: {e}")
        
        return task
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取角色列表
@router.get("/characters")
def get_characters(username: str = Depends(get_current_user)):
    """获取角色列表"""
    try:
        return {"characters": video_service.get_characters(username)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
