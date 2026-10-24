"""依赖注入：数据库 session、JWT 鉴权。"""

from __future__ import annotations

from typing import Generator
import math
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal

security = HTTPBearer(auto_error=False)


def _decode_admin(token: str) -> bool:
    try:
        # Validate exp ourselves: python-jose coerces strings/bools and can raise
        # TypeError/OverflowError for hostile claims. Signature verification stays on.
        payload = jwt.decode(token, settings.JWT_SECRET_KEY,
                             algorithms=[settings.JWT_ALGORITHM], options={'verify_exp': False})
        expiry = payload.get('exp')
        if (payload.get('sub') != settings.ADMIN_USERNAME
                or isinstance(expiry, bool) or not isinstance(expiry, (int, float))
                or not math.isfinite(expiry) or expiry <= time.time()):
            raise JWTError('Invalid required claims')
    except (JWTError, TypeError, ValueError, OverflowError) as exc:
        raise HTTPException(status_code=401, detail='无效或过期 Token') from exc
    return True


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
    return _decode_admin(credentials.credentials)


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
    return _decode_admin(credentials.credentials)
