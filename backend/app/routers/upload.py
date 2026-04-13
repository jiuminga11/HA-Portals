"""文件上传路由。"""

from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_current_admin, get_db
from app.models import Section, SiteConfig, UploadedFile
from app.schemas import FileResponse, UploadResponse

router = APIRouter()


def _is_file_referenced(file_url: str, db: Session) -> bool:
    """检查文件是否被 site_config 或 section.content 引用。"""
    config = db.query(SiteConfig).first()
    if config:
        if config.logo_url == file_url or config.banner_url == file_url:
            return True

    sections = db.query(Section).all()
    for section in sections:
        if file_url in (section.content or ""):
            return True

    return False


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> UploadResponse:
    """上传文件（需鉴权）。校验类型和大小后存储到本地。"""
    # 校验 MIME 类型
    allowed_types = settings.ALLOWED_IMAGE_TYPES + settings.ALLOWED_VIDEO_TYPES
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"不支持的文件类型: {file.content_type}",
        )

    # 校验扩展名
    original_name = file.filename or "unknown"
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"不支持的文件扩展名: {ext}",
        )

    # 读取文件内容并校验大小
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="文件大小超过限制",
        )

    # UUID 重命名
    stored_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    file_url = f"/uploads/{stored_name}"

    # 确保目录存在
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # 写入磁盘
    with open(file_path, "wb") as f:
        f.write(content)

    # 写入数据库
    record = UploadedFile(
        filename=original_name,
        stored_name=stored_name,
        file_path=file_path,
        file_url=file_url,
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return UploadResponse(
        id=record.id, file_url=record.file_url, filename=record.filename
    )


@router.get("/files", response_model=list[FileResponse])
def list_files(
    type: str = "all",
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> list[FileResponse]:
    """获取文件列表（需鉴权）。可按 type=image|video|all 筛选。"""
    query = db.query(UploadedFile)

    if type == "image":
        query = query.filter(UploadedFile.mime_type.in_(settings.ALLOWED_IMAGE_TYPES))
    elif type == "video":
        query = query.filter(UploadedFile.mime_type.in_(settings.ALLOWED_VIDEO_TYPES))

    return query.order_by(UploadedFile.created_at.desc()).all()


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> Response:
    """删除文件（需鉴权）。有引用时返回 409。"""
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    if _is_file_referenced(record.file_url, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="文件正在被使用，无法删除",
        )

    # 删除磁盘文件
    if os.path.exists(record.file_path):
        os.remove(record.file_path)

    # 删除数据库记录
    db.delete(record)
    db.commit()
