from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from .. import auth
from ..schemas import LoginReq, RegisterReq, ProfileReq

router = APIRouter(prefix="/api", tags=["Auth"])
security = HTTPBearer()

# Dependency to get current user from token
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/login")
def login(req: LoginReq):
    if auth.authenticate_user(req.username, req.password):
        profile = auth.get_user_profile(req.username)
        return {"token": auth.create_token(req.username), "profile": profile}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/register")
def register(req: RegisterReq):
    if not req.username or not req.password:
        raise HTTPException(status_code=400, detail="Missing credentials")
    nickname = req.nickname or req.username
    created = auth.create_user(req.username, req.password, nickname, req.avatar_url or "")
    if not created:
        raise HTTPException(status_code=409, detail="Username already exists")
    profile = auth.get_user_profile(req.username)
    return {"token": auth.create_token(req.username), "profile": profile}

@router.post("/profile")
def update_profile(req: ProfileReq, user=Depends(auth.verify_token)):
    nickname = req.nickname or user
    avatar_url = req.avatar_url or ""
    profile = auth.update_profile(user, nickname, avatar_url)
    return {"ok": True, "profile": profile}
