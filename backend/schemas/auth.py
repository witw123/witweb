"""Authentication related schemas"""
from pydantic import BaseModel


class LoginReq(BaseModel):
    username: str
    password: str


class RegisterReq(BaseModel):
    username: str
    password: str
    nickname: str = ""
    avatar_url: str = ""


class ProfileReq(BaseModel):
    nickname: str = ""
    avatar_url: str = ""
