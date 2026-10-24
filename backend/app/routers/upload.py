"""文件上传路由。"""

from __future__ import annotations

import os
import uuid
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.deps import get_current_admin, get_db
from app.models import Section, SiteConfig, UploadedFile
from app.schemas import FileResponse, UploadResponse
from app.file_references import local_asset, local_references, writer_lock

router = APIRouter()
logger = logging.getLogger(__name__)


def _record_exists_after_failure(db: Session, stored_name: str) -> bool | None:
    """Re-read durable state independently; a failed commit may already be durable.

    None means verification failed. Never discard the only file copy in that case.
    """
    bind = db.get_bind()
    try:
        db.rollback()
    except SQLAlchemyError:
        # after_commit failures can leave a committed Session unable to roll back.
        try:
            db.close()
        except SQLAlchemyError:
            logger.error('Cannot reset failed file transaction; preserving file for recovery')
            return None
    try:
        with Session(bind=bind) as verification:
            return verification.query(UploadedFile.id).filter(
                UploadedFile.stored_name == stored_name).first() is not None
    except SQLAlchemyError:
        logger.error('Cannot verify file transaction outcome; preserving file for recovery')
        return None


def _is_file_referenced(file_url: str, db: Session) -> bool:
    """检查文件是否被 site_config 或 section.content 引用。"""
    config = db.query(SiteConfig).first()
    name = local_asset(file_url)
    if config:
        urls = (config.logo_url, config.banner_url, config.seo_og_image)
        if file_url in urls or (name and name in local_references(list(urls), include_absolute=True)):
            return True

    sections = db.query(Section).all()
    for section in sections:
        if file_url in (section.content or "") or (name and name in local_references(json.loads(section.content or '{}'), include_absolute=True)):
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
    allowed_types = (
        settings.ALLOWED_IMAGE_TYPES + settings.ALLOWED_VIDEO_TYPES
        + settings.ALLOWED_DOCUMENT_TYPES
    )
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

    mime_extensions = {
        "image/jpeg": {".jpg", ".jpeg"},
        "image/png": {".png"},
        "image/gif": {".gif"},
        "image/webp": {".webp"},
        "video/mp4": {".mp4"},
        "video/webm": {".webm"},
        "application/pdf": {".pdf"},
    }
    if ext not in mime_extensions.get(file.content_type, set()):
        raise HTTPException(status_code=415, detail="文件扩展名与 MIME 类型不匹配")

    # UUID 重命名
    stored_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    file_url = f"/uploads/{stored_name}"

    size = 0
    header = b''
    created = False
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        with open(file_path, "xb") as destination:
            created = True
            while True:
                chunk = await file.read(min(64 * 1024, settings.MAX_FILE_SIZE - size + 1))
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="文件大小超过限制")
                header = (header + chunk)[:5]
                destination.write(chunk)
        if file.content_type == 'application/pdf' and header != b'%PDF-':
            raise HTTPException(status_code=415, detail='PDF 文件头无效')
        record = UploadedFile(filename=original_name, stored_name=stored_name,
                              file_path=file_path, file_url=file_url, file_size=size,
                              mime_type=file.content_type)
        db.add(record)
        db.commit()
    except (HTTPException, OSError, SQLAlchemyError) as exc:
        exists = _record_exists_after_failure(db, stored_name)
        if created and exists is False:
            try:
                Path(file_path).unlink(missing_ok=True)
            except OSError:
                logger.error('Upload compensation failed; orphan requires operator cleanup')
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=503, detail='文件保存结果待确认，请刷新文件列表后核对') from exc
    # A refresh failure occurs after commit: never compensate a committed upload.
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
    writer_lock(db)
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    if _is_file_referenced(record.file_url, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="文件正在被使用，无法删除",
        )

    original = Path(record.file_path)
    stored_name = record.stored_name
    staged = original.parent / '.pending-delete' / f'{uuid.uuid4()}-{original.name}'
    moved = False
    try:
        if original.exists():
            staged.parent.mkdir(exist_ok=True)
            original.replace(staged)
            moved = True
        db.delete(record)
        db.commit()
    except (OSError, SQLAlchemyError) as exc:
        exists = _record_exists_after_failure(db, stored_name)
        if moved:
            try:
                if exists is False:
                    staged.unlink()
                else:
                    # Unknown outcome: retaining a possible orphan is safer than
                    # destroying a committed record's only file copy.
                    staged.replace(original)
            except OSError:
                logger.error('Delete compensation failed; staged file requires operator recovery')
        raise HTTPException(status_code=503, detail='文件删除结果待确认，请刷新文件列表后核对') from exc
    if moved:
        try:
            staged.unlink()
        except OSError:
            logger.warning('Committed deletion left a staged file for operator cleanup')
    return Response(status_code=204)
