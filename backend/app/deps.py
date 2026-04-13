"""依赖注入：数据库 session、JWT 鉴权。"""

from __future__ import annotations

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal

security = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """数据库 session 生成器。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> bool:
    """强制鉴权：必须有有效 Token。用于写操作接口。"""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    try:
        jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return True
    except JWTError as exc:
        detail = "Token 已过期" if "expired" in str(exc).lower() else "无效 Token"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_optional_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> bool:
    """
    可选鉴权：
    - 无 Token → False（公开模式）
    - 有效 Token → True（管理模式）
    - 无效/过期 Token → 401
    """
    if credentials is None:
        return False
    try:
        jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return True
    except JWTError as exc:
        detail = "Token 已过期" if "expired" in str(exc).lower() else "无效 Token"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
