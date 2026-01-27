"""Blog related schemas"""
from typing import Optional
from pydantic import BaseModel


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
