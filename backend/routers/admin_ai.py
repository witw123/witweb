"""
AI服务管理API路由（仅管理员）
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

try:
    from ..routers.auth import get_current_user
    from ..services.grsai_client import grsai_client
    from ..services.api_config import (
        get_api_token, save_api_token, 
        get_api_base_url, save_api_base_url,
        get_sora2_api_key, save_sora2_api_key
    )
    from .. import core as studio_core
except ImportError:
    from backend.routers.auth import get_current_user
    from backend.services.grsai_client import grsai_client
    from backend.services.api_config import (
        get_api_token, save_api_token, 
        get_api_base_url, save_api_base_url,
        get_sora2_api_key, save_sora2_api_key
    )
    from backend import core as studio_core

router = APIRouter(prefix="/api/admin/ai", tags=["AI Admin"])

# Pydantic模型
class APIKeyCreate(BaseModel):
    name: str
    type: int = 0  # 0: 无限制, 1: 限制额度
    credits: int = 0
    expireTime: int = 0

class CreditsResponse(BaseModel):
    credits: int

class ModelStatusResponse(BaseModel):
    status: bool
    error: str

class TokenConfig(BaseModel):
    token: str

class TokenResponse(BaseModel):
    has_token: bool
    token_preview: Optional[str] = None

class BaseURLConfig(BaseModel):
    base_url: str

class BaseURLResponse(BaseModel):
    base_url: Optional[str] = None

# 管理员权限检查
def require_admin(username: str = Depends(get_current_user)) -> str:
    """要求管理员权限"""
    if username != "witw":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username

# 获取API Token配置状态
@router.get("/config/token", response_model=TokenResponse)
def get_token_config(username: str = Depends(require_admin)):
    """获取API Token配置状态（仅管理员）"""
    token = get_api_token()
    if token:
        # 只返回前后各4个字符作为预览
        preview = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else "****"
        return {"has_token": True, "token_preview": preview}
    return {"has_token": False, "token_preview": None}

# 保存API Token
@router.post("/config/token")
def save_token_config(
    config: TokenConfig,
    username: str = Depends(require_admin)
):
    """保存API Token配置（仅管理员）"""
    if not config.token or not config.token.strip():
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    
    success = save_api_token(config.token.strip())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save token")
    
    # 更新全局客户端的token
    grsai_client.token = config.token.strip()
    
    return {"ok": True, "message": "Token saved successfully"}

# 获取API Base URL配置
@router.get("/config/base-url", response_model=BaseURLResponse)
def get_base_url_config(username: str = Depends(require_admin)):
    """获取API Base URL配置（仅管理员）"""
    base_url = get_api_base_url()
    return {"base_url": base_url or "https://grsaiapi.com"}

# 保存API Base URL
@router.post("/config/base-url")
def save_base_url_config(
    config: BaseURLConfig,
    username: str = Depends(require_admin)
):
    """保存API Base URL配置（仅管理员）"""
    if not config.base_url or not config.base_url.strip():
        raise HTTPException(status_code=400, detail="Base URL cannot be empty")
    
    success = save_api_base_url(config.base_url.strip())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save base URL")
    
    # 更新全局客户端的base_url
    grsai_client.base_url = config.base_url.strip()
    
    return {"ok": True, "message": "Base URL saved successfully"}

# 获取Sora2 API Key配置
@router.get("/config/sora2-key", response_model=TokenResponse)
def get_sora2_key_config(username: str = Depends(require_admin)):
    """获取Sora2 API Key配置（仅管理员）"""
    api_key = get_sora2_api_key()
    if api_key:
        # 只返回前后各4个字符作为预览
        preview = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "****"
        return {"has_token": True, "token_preview": preview}
    return {"has_token": False, "token_preview": None}

# 保存Sora2 API Key
@router.post("/config/sora2-key")
def save_sora2_key_config(
    config: TokenConfig,
    username: str = Depends(require_admin)
):
    """保存Sora2 API Key配置（仅管理员）"""
    if not config.token or not config.token.strip():
        raise HTTPException(status_code=400, detail="API Key cannot be empty")
    
    success = save_sora2_api_key(config.token.strip())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save API key")
    
    try:
        studio_core.set_api_key(config.token.strip())
    except Exception:
        pass
    
    return {"ok": True, "message": "Sora2 API Key saved successfully"}

# 获取账户余额
@router.get("/credits", response_model=CreditsResponse)
def get_account_credits(username: str = Depends(require_admin)):
    """获取账户积分余额（仅管理员）"""
    try:
        credits = grsai_client.get_credits()
        return {"credits": credits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 创建APIKey
@router.post("/apikeys")
def create_api_key(
    key_data: APIKeyCreate,
    username: str = Depends(require_admin)
):
    """创建APIKey（仅管理员）"""
    try:
        result = grsai_client.create_api_key(
            name=key_data.name,
            key_type=key_data.type,
            credits=key_data.credits,
            expire_time=key_data.expireTime
        )
        return {"ok": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取APIKey余额
@router.get("/apikeys/{api_key}/credits", response_model=CreditsResponse)
def get_api_key_credits(
    api_key: str,
    username: str = Depends(require_admin)
):
    """获取APIKey积分余额（仅管理员）"""
    try:
        credits = grsai_client.get_api_key_credits(api_key)
        return {"credits": credits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 获取模型状态
@router.get("/models/{model_name}/status", response_model=ModelStatusResponse)
def get_model_status(
    model_name: str,
    username: str = Depends(require_admin)
):
    """获取模型状态（仅管理员）"""
    try:
        status_data = grsai_client.get_model_status(model_name)
        return {
            "status": status_data.get("status", False),
            "error": status_data.get("error", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
