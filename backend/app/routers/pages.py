"""页面管理路由。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_admin, get_db
from app.models import Page, Section
from app.schemas import (
    PageCreate,
    PageReorderRequest,
    PageResponse,
    PageUpdate,
    SectionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _normalize_page_sort_order(db: Session) -> None:
    """将所有 page 的 sort_order 归一化为连续整数 0..n-1。"""
    pages = db.query(Page).order_by(Page.sort_order, Page.id).all()
    for idx, page in enumerate(pages):
        if page.sort_order != idx:
            page.sort_order = idx
    db.commit()


# ---------- Public ----------


@router.get("/pages", response_model=list[PageResponse])
def list_pages(
    db: Session = Depends(get_db),
) -> list[PageResponse]:
    """获取所有可见页面列表（公开接口，按 sort_order 排序）。"""
    pages = (
        db.query(Page).filter(Page.visible.is_(True)).order_by(Page.sort_order).all()
    )
    return [PageResponse.model_validate(p) for p in pages]


@router.get("/pages/{slug}", response_model=PageResponse)
def get_page_by_slug(
    slug: str,
    db: Session = Depends(get_db),
) -> PageResponse:
    """根据 slug 获取单个页面信息（公开接口，仅返回可见页面）。"""
    page = db.query(Page).filter(Page.slug == slug, Page.visible.is_(True)).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在或不可见",
        )
    return PageResponse.model_validate(page)


@router.get("/pages/{slug}/sections", response_model=list[SectionResponse])
def get_page_sections(
    slug: str,
    db: Session = Depends(get_db),
) -> list[SectionResponse]:
    """获取指定页面的可见 sections（公开接口，按 sort_order 排序）。"""
    import json

    page = db.query(Page).filter(Page.slug == slug, Page.visible.is_(True)).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在或不可见",
        )

    sections = (
        db.query(Section)
        .filter(Section.page_id == page.id, Section.visible.is_(True))
        .order_by(Section.sort_order)
        .all()
    )

    results = []
    for s in sections:
        content = json.loads(s.content) if isinstance(s.content, str) else s.content
        results.append(
            SectionResponse(
                id=s.id,
                page_id=s.page_id,
                title_zh=s.title_zh,
                title_en=s.title_en,
                type=s.type,
                sort_order=s.sort_order,
                visible=s.visible,
                content=content,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )
    return results


# ---------- Admin ----------


@router.get("/admin/pages", response_model=list[PageResponse])
def admin_list_pages(
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> list[PageResponse]:
    """获取所有页面列表（管理接口，包括隐藏页面）。"""
    pages = db.query(Page).order_by(Page.sort_order).all()
    return [PageResponse.model_validate(p) for p in pages]


@router.post(
    "/admin/pages",
    response_model=PageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_page(
    body: PageCreate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> PageResponse:
    """新建页面（需鉴权）。"""
    # 检查 slug 唯一性
    existing = db.query(Page).filter(Page.slug == body.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"slug '{body.slug}' 已存在",
        )

    # sort_order 设为当前最大值 +1
    max_order = db.query(Page.sort_order).order_by(Page.sort_order.desc()).first()
    next_order = (max_order[0] + 1) if max_order else 0

    page = Page(
        slug=body.slug,
        title_zh=body.title_zh,
        title_en=body.title_en,
        meta_description_zh=body.meta_description_zh,
        meta_description_en=body.meta_description_en,
        visible=body.visible,
        sort_order=next_order,
    )
    db.add(page)
    db.commit()
    db.refresh(page)

    _normalize_page_sort_order(db)
    db.refresh(page)
    return PageResponse.model_validate(page)


@router.put("/admin/pages/reorder", response_model=list[PageResponse])
def reorder_pages(
    body: PageReorderRequest,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> list[PageResponse]:
    """批量更新页面排序（需鉴权）。接收完整的 id+sort_order 映射。"""
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
    db_pages = db.query(Page).filter(Page.id.in_(order_map.keys())).all()
    # 校验：所有 ID 都必须存在
    if len(db_pages) != len(order_map):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="部分 page ID 不存在",
        )

    for p in db_pages:
        if p.id in order_map:
            p.sort_order = order_map[p.id]

    db.commit()
    _normalize_page_sort_order(db)

    all_pages = db.query(Page).order_by(Page.sort_order).all()
    return [PageResponse.model_validate(p) for p in all_pages]


@router.put("/admin/pages/{page_id}", response_model=PageResponse)
def update_page(
    page_id: int,
    body: PageUpdate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> PageResponse:
    """更新页面（需鉴权）。"""
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )

    update_data = body.model_dump(exclude_unset=True)

    if "slug" in update_data:
        if update_data["slug"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="slug 不允许为 null",
            )
        # 检查 slug 唯一性（排除自身）
        existing = (
            db.query(Page)
            .filter(Page.slug == update_data["slug"], Page.id != page_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"slug '{update_data['slug']}' 已存在",
            )
        page.slug = update_data["slug"]

    if "title_zh" in update_data:
        if update_data["title_zh"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="title_zh 不允许为 null",
            )
        page.title_zh = update_data["title_zh"]

    if "title_en" in update_data:
        page.title_en = update_data["title_en"] or ""

    if "meta_description_zh" in update_data:
        page.meta_description_zh = update_data["meta_description_zh"] or ""

    if "meta_description_en" in update_data:
        page.meta_description_en = update_data["meta_description_en"] or ""

    if "visible" in update_data:
        if update_data["visible"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="visible 不允许为 null",
            )
        page.visible = update_data["visible"]

    db.commit()
    db.refresh(page)
    return PageResponse.model_validate(page)


@router.delete(
    "/admin/pages/{page_id}",
    response_model=dict,
)
def delete_page(
    page_id: int,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> dict:
    """删除页面及其所有 sections（需鉴权）。"""
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="页面不存在",
        )

    # 删除该页面下所有 sections
    db.query(Section).filter(Section.page_id == page_id).delete()
    db.delete(page)
    db.commit()
    _normalize_page_sort_order(db)
    return {"detail": "deleted"}
