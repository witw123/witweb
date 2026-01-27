"""Schemas package - exports all schema models"""
from .auth import LoginReq, RegisterReq, ProfileReq
from .blog import PostReq, UpdatePostReq, CommentReq
from .studio import (
    GenReq, FinalizeReq, HostReq, ResultReq,
    UploadCharacterReq, CreateCharacterReq,
    ApiKeyReq, TokenReq, QueryDefaultsReq,
    CreateApiKeyReq, ApiKeyCreditsReq, CreditsReq,
    ModelStatusReq, ActiveTaskRemoveReq, VideoDeleteReq
)

__all__ = [
    # Auth
    "LoginReq", "RegisterReq", "ProfileReq",
    # Blog
    "PostReq", "UpdatePostReq", "CommentReq",
    # Studio
    "GenReq", "FinalizeReq", "HostReq", "ResultReq",
    "UploadCharacterReq", "CreateCharacterReq",
    "ApiKeyReq", "TokenReq", "QueryDefaultsReq",
    "CreateApiKeyReq", "ApiKeyCreditsReq", "CreditsReq",
    "ModelStatusReq", "ActiveTaskRemoveReq", "VideoDeleteReq",
]
