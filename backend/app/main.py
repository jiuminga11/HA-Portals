"""FastAPI 应用入口。"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import SiteConfig
from app.routers import auth, pages, sections, site_config, upload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期：确保目录存在 + 建表 + 初始化配置。"""
    # 确保上传目录和数据目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs("data", exist_ok=True)
    logger.info("目录已就绪: %s, data/", settings.UPLOAD_DIR)

    Base.metadata.create_all(bind=engine)
    logger.info("数据库表已创建/确认")

    db = SessionLocal()
    try:
        if not db.query(SiteConfig).first():
            db.add(SiteConfig(id=1))
            db.commit()
            logger.info("已初始化默认站点配置")
    finally:
        db.close()

    yield


app = FastAPI(title="HA-PORTALS API", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件（开发环境；生产环境由 Nginx 代理）
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(site_config.router, prefix="/api", tags=["站点配置"])
app.include_router(sections.router, prefix="/api", tags=["内容区块"])
app.include_router(upload.router, prefix="/api", tags=["文件上传"])
app.include_router(pages.router, prefix="/api", tags=["页面管理"])
