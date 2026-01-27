from typing import Optional
from pydantic import BaseModel

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

class UpdatePostReq(BaseModel):
    title: str
    content: str
    tags: Optional[str] = ""

class CommentReq(BaseModel):
    content: str
    author: Optional[str] = None
    parent_id: Optional[int] = None

class ProfileReq(BaseModel):
    nickname: str = ""
    avatar_url: str = ""
