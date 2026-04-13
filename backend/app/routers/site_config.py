"""站点配置路由。"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_admin, get_db
from app.models import SiteConfig
from app.schemas import SiteConfigResponse, SiteConfigUpdate

router = APIRouter()

# 不可为 null 的字段列表
_NON_NULLABLE_FIELDS = {
    "site_title",
    "project_title",
    "footer_text",
    "primary_color",
    "gradient_color",
    "accent_color",
    "theme_preset",
    "font_size",
    "default_theme",
    "default_locale",
    "seo_default_title_zh",
    "seo_default_title_en",
    "seo_default_description_zh",
    "seo_default_description_en",
}


def _get_or_create_config(db: Session) -> SiteConfig:
    """获取站点配置，不存在则创建默认记录。"""
    config = db.query(SiteConfig).filter(SiteConfig.id == 1).first()
    if not config:
        config = SiteConfig(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/site-config", response_model=SiteConfigResponse)
def get_site_config(db: Session = Depends(get_db)) -> SiteConfig:
    """获取站点配置（公开接口）。"""
    return _get_or_create_config(db)


@router.put("/site-config", response_model=SiteConfigResponse)
def update_site_config(
    body: SiteConfigUpdate,
    db: Session = Depends(get_db),
    _admin: bool = Depends(get_current_admin),
) -> SiteConfig:
    """更新站点配置（需鉴权）。仅更新显式传入的字段。"""
    config = _get_or_create_config(db)
    update_data = body.model_dump(exclude_unset=True)

    # 校验不可为 null 的字段
    for field_name in _NON_NULLABLE_FIELDS:
        if field_name in update_data and update_data[field_name] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"字段 {field_name} 不允许为空",
            )

    for field_name, value in update_data.items():
        setattr(config, field_name, value)

    db.commit()
    db.refresh(config)
    return config
