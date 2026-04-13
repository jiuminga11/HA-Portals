"""Pydantic 请求/响应模型。"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


# ===== Auth =====


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ===== SiteConfig =====


class SiteConfigResponse(BaseModel):
    site_title: str
    project_title: str
    logo_url: str | None
    banner_url: str | None
    footer_text: str
    primary_color: str
    gradient_color: str
    accent_color: str
    theme_preset: str
    font_size: str
    default_theme: str
    default_locale: str
    seo_default_title_zh: str
    seo_default_title_en: str
    seo_default_description_zh: str
    seo_default_description_en: str
    seo_og_image: str | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class SiteConfigUpdate(BaseModel):
    """
    更新语义：
    - 字段未传（不在 JSON 中）→ 不更新
    - logo_url / banner_url / seo_og_image 传 null → 清空
    - 其他字段传 null → 拒绝（400）
    - 字段传值 → 更新为新值
    """

    logo_url: str | None = None
    banner_url: str | None = None
    site_title: str | None = None
    project_title: str | None = None
    footer_text: str | None = None
    primary_color: str | None = None
    gradient_color: str | None = None
    accent_color: str | None = None
    theme_preset: str | None = None
    font_size: str | None = None
    default_theme: str | None = None
    default_locale: str | None = None
    seo_default_title_zh: str | None = None
    seo_default_title_en: str | None = None
    seo_default_description_zh: str | None = None
    seo_default_description_en: str | None = None
    seo_og_image: str | None = None

    @field_validator("theme_preset", mode="before")
    @classmethod
    def validate_theme_preset(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = ("academic-slate-blue", "medical-teal", "dawn-soft-dark")
        if v not in allowed:
            raise ValueError(f"theme_preset 必须为 {allowed} 之一")
        return v

    @field_validator("font_size", mode="before")
    @classmethod
    def validate_font_size(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = ("standard", "large", "extra-large")
        if v not in allowed:
            raise ValueError(f"font_size 必须为 {allowed} 之一")
        return v

    @field_validator("primary_color", "gradient_color", "accent_color", mode="before")
    @classmethod
    def validate_hex_color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("颜色值必须为 #RRGGBB 格式")
        return v.upper()

    @field_validator("default_theme", mode="before")
    @classmethod
    def validate_default_theme(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = ("light", "dark", "system")
        if v not in allowed:
            raise ValueError(f"default_theme 必须为 {allowed} 之一")
        return v

    @field_validator("default_locale", mode="before")
    @classmethod
    def validate_default_locale(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = ("zh", "en")
        if v not in allowed:
            raise ValueError(f"default_locale 必须为 {allowed} 之一")
        return v


# ===== Page =====


class PageCreate(BaseModel):
    slug: str
    title_zh: str
    title_en: str = ""
    meta_description_zh: str = ""
    meta_description_en: str = ""
    visible: bool = True

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("slug 不能为空")
        if not re.match(r"^[a-z0-9][a-z0-9-]*$", v):
            raise ValueError("slug 只能包含小写字母、数字和连字符，且不能以连字符开头")
        return v

    @field_validator("title_zh")
    @classmethod
    def validate_title_zh(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("页面中文标题不能为空")
        return v


class PageUpdate(BaseModel):
    slug: str | None = None
    title_zh: str | None = None
    title_en: str | None = None
    meta_description_zh: str | None = None
    meta_description_en: str | None = None
    visible: bool | None = None

    @field_validator("slug", mode="before")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not v:
            raise ValueError("slug 不能为空")
        if not re.match(r"^[a-z0-9][a-z0-9-]*$", v):
            raise ValueError("slug 只能包含小写字母、数字和连字符，且不能以连字符开头")
        return v

    @field_validator("title_zh", mode="before")
    @classmethod
    def validate_title_zh(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("页面中文标题不能为空")
        return v


class PageResponse(BaseModel):
    id: int
    slug: str
    title_zh: str
    title_en: str
    meta_description_zh: str
    meta_description_en: str
    sort_order: int
    visible: bool
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class PageReorderRequest(BaseModel):
    orders: list[ReorderItem]


# ===== Section =====


class SectionCreate(BaseModel):
    page_id: int
    title_zh: str
    title_en: str = ""
    type: Literal["rich_text", "image_gallery", "data_table", "external_links", "video", "metric_cards", "timeline", "profile_hero"]
    visible: bool = True
    content: dict | None = None

    @field_validator("title_zh")
    @classmethod
    def validate_title_zh(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("区块中文标题不能为空")
        return v


class SectionUpdate(BaseModel):
    title_zh: str | None = None
    title_en: str | None = None
    visible: bool | None = None
    content: dict | None = None

    @field_validator("title_zh", mode="before")
    @classmethod
    def validate_title_zh(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("区块中文标题不能为空")
        return v


class SectionResponse(BaseModel):
    id: int
    page_id: int
    title_zh: str
    title_en: str
    type: str
    sort_order: int
    visible: bool
    content: dict
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}



class SectionReorderRequest(BaseModel):
    orders: list[ReorderItem]


# ===== File =====


class FileResponse(BaseModel):
    id: int
    filename: str
    file_url: str
    file_size: int
    mime_type: str
    created_at: datetime | None

    model_config = {"from_attributes": True}


class UploadResponse(BaseModel):
    id: int
    file_url: str
    filename: str
