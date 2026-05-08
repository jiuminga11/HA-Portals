"""应用配置，从环境变量或 .env 文件读取。"""

from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 管理员账号
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str  # No default — must be set in .env

    # JWT
    JWT_SECRET_KEY: str  # No default — must be set in .env
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 小时

    # 文件上传
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_IMAGE_TYPES: List[str] = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
    ]
    ALLOWED_VIDEO_TYPES: List[str] = ["video/mp4", "video/webm"]
    ALLOWED_DOCUMENT_TYPES: List[str] = ["application/pdf"]
    ALLOWED_EXTENSIONS: List[str] = [
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".pdf",
    ]

    # 数据库
    DATABASE_URL: str = "sqlite:///./data/ha-portals.db"

    # CORS（开发环境）
    CORS_ORIGINS: List[str] = ["http://localhost:5174"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
