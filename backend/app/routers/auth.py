"""登录鉴权路由。"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from jose import jwt

from app.config import settings
from app.schemas import LoginRequest, LoginResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest) -> LoginResponse:
    """管理员登录，返回 JWT Token。"""
    if (
        body.username != settings.ADMIN_USERNAME
        or body.password != settings.ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    expire_seconds = settings.JWT_EXPIRE_MINUTES * 60
    payload = {
        "sub": body.username,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expire_seconds),
    }
    token = jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )

    return LoginResponse(
        access_token=token,
        expires_in=expire_seconds,
    )
