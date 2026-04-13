"""内容区块 CRUD 路由。"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.content_schemas import DEFAULT_CONTENT_MAP, validate_content
from app.deps import get_current_admin, get_db, get_optional_admin
from app.models import Page, Section
from app.sanitizer import check_html_safe
from app.schemas import (
    SectionCreate,
    SectionReorderRequest,
    SectionResponse,
    SectionUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _section_to_response(section: Section) -> SectionResponse:
    """将 ORM 对象转为响应模型（content 从 JSON 字符串解析为 dict）。"""
    content = (
        json.loads(section.content)
        if isinstance(section.content, str)
        else section.content
    )
    return SectionResponse(
        id=section.id,
        page_id=section.page_id,
        title_zh=section.title_zh,
        title_en=section.title_en,
        type=section.type,
        sort_order=section.sort_order,
        visible=section.visible,
        content=content,
        created_at=section.created_at,
        updated_at=section.updated_at,
    )


def _normalize_sort_order(db: Session, page_id: int) -> None:
    """将指定页面的 section sort_order 归一化为连续整数 0..n-1。"""
    sections = (
        db.query(Section)
        .filter(Section.page_id == page_id)
        .order_by(Section.sort_order, Section.id)
        .all()
    )
    for idx, section in enumerate(sections):
        if section.sort_order != idx:
            section.sort_order = idx
    db.commit()


def _validate_and_sanitize(section_type: str, content: dict) -> dict:
    """校验 content 结构 + 富文本安全检查。抛出 HTTPException 400 而非放任 500。"""
    try:
        validated = validate_content(section_type, content)
    except (ValidationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"content 校验失败: {exc}",
        )

    if section_type == "rich_text":
        body = validated.get("body", "")
        is_safe, reason = check_html_safe(body)
        if not is_safe:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    return validated


# ---------- Public ----------


@router.get("/sections", response_model=list[SectionResponse])
def list_sections(
    page_id: int | None = Query(default=None, description="按页面 ID 过滤"),
    db: Session = Depends(get_db),
    is_admin: bool = Depends(get_optional_admin),
) -> list[SectionResponse]:
    """获取区块列表。公开模式仅返回可见区块，管理模式返回全部。支持 page_id 过滤。"""
    query = db.query(Section).order_by(Section.sort_order)
    if page_id is not None:
        query = query.filter(Section.page_id == page_id)
    if not is_admin:
        query = query.join(Page, Section.page_id == Page.id).filter(
            Page.visible.is_(True), Section.visible.is_(True)
        )
    return [_section_to_response(s) for s in query.all()]


# ---------- Admin CRUD ----------


@router.post(
    "/sections", response_model=SectionResponse, status_code=status.HTTP_201_CREATED
)
def create_section(
    body: SectionCreate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> SectionResponse:
    """新建区块（需鉴权）。"""
    # 验证 page_id 存在
    page = db.query(Page).filter(Page.id == body.page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目标页面不存在",
        )

    content = body.content or DEFAULT_CONTENT_MAP.get(body.type, {})
    validated_content = _validate_and_sanitize(body.type, content)

    # sort_order 设为该页面内当前最大值 +1
    max_order = (
        db.query(Section.sort_order)
        .filter(Section.page_id == body.page_id)
        .order_by(Section.sort_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    section = Section(
        page_id=body.page_id,
        title_zh=body.title_zh,
        title_en=body.title_en,
        type=body.type,
        visible=body.visible,
        sort_order=next_order,
        content=json.dumps(validated_content, ensure_ascii=False),
    )
    db.add(section)
    db.commit()
    db.refresh(section)

    _normalize_sort_order(db, body.page_id)
    db.refresh(section)
    return _section_to_response(section)


@router.put("/sections/reorder", response_model=list[SectionResponse])
def reorder_sections(
    body: SectionReorderRequest,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> list[SectionResponse]:
    """批量更新区块排序（需鉴权）。接收完整的 id+sort_order 映射。"""
    # 校验：检查重复 ID
    ids = [item.id for item in body.orders]
    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="orders 中存在重复 ID",
        )
    # 校验：sort_order 不可为负
    if any(item.sort_order < 0 for item in body.orders):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_order 不可为负",
        )
    order_map = {item.id: item.sort_order for item in body.orders}
    db_sections = db.query(Section).filter(Section.id.in_(order_map.keys())).all()
    # 校验：所有 ID 都必须存在
    if len(db_sections) != len(order_map):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="部分 section ID 不存在",
        )

    # 收集涉及的 page_ids 用于后续归一化
    affected_page_ids: set[int] = set()
    for s in db_sections:
        if s.id in order_map:
            s.sort_order = order_map[s.id]
            affected_page_ids.add(s.page_id)

    db.commit()

    for pid in affected_page_ids:
        _normalize_sort_order(db, pid)

    all_sections = db.query(Section).order_by(Section.sort_order).all()
    return [_section_to_response(s) for s in all_sections]


@router.put("/sections/{section_id}", response_model=SectionResponse)
def update_section(
    section_id: int,
    body: SectionUpdate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> SectionResponse:
    """更新区块（需鉴权）。content 为全量替换。"""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="区块不存在")

    update_data = body.model_dump(exclude_unset=True)

    # 拒绝 NOT NULL 字段传 null（防止 500 IntegrityError）
    if "title_zh" in update_data:
        if update_data["title_zh"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="title_zh 不允许为 null",
            )
        section.title_zh = update_data["title_zh"]

    if "title_en" in update_data:
        section.title_en = update_data["title_en"] or ""

    if "visible" in update_data:
        if update_data["visible"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visible 不允许为 null",
            )
        section.visible = update_data["visible"]

    if "content" in update_data:
        if update_data["content"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="content 不允许为 null",
            )
        validated_content = _validate_and_sanitize(section.type, update_data["content"])
        section.content = json.dumps(validated_content, ensure_ascii=False)

    db.commit()
    db.refresh(section)
    return _section_to_response(section)


@router.delete(
    "/sections/{section_id}",
    response_model=dict,
)
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> dict:
    """删除区块（需鉴权）。"""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="区块不存在")

    page_id = section.page_id
    db.delete(section)
    db.commit()
    _normalize_sort_order(db, page_id)
    return {"detail": "deleted"}
