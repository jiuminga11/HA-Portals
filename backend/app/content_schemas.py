"""按区块类型分别定义 content 的 Pydantic 校验模型。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ===== rich_text =====


class RichTextContent(BaseModel):
    # 100KB 上限：防恶意提交 GB 级 body 致 OOM。正常富文本远达不到。
    body: str = Field(default="", max_length=100_000)


# ===== image_gallery =====


class ImageGalleryItem(BaseModel):
    url: str
    caption: str | None = None


class ImageGalleryContent(BaseModel):
    columns: int = 4
    page_size: int = 8
    items: list[ImageGalleryItem] = []

    @field_validator("columns")
    @classmethod
    def validate_columns(cls, v: int) -> int:
        if not 2 <= v <= 6:
            raise ValueError("columns 必须在 2-6 之间")
        return v

    @field_validator("page_size")
    @classmethod
    def validate_page_size(cls, v: int) -> int:
        if v != 0 and not 4 <= v <= 20:
            raise ValueError("page_size 必须为 0 或 4-20 之间")
        return v


# ===== data_table =====


class DataTableColumn(BaseModel):
    key: str
    title: str
    width: int | None = None
    align: Literal['left', 'center', 'right'] | None = None
    bold: bool | None = None


class DataTableContent(BaseModel):
    columns: list[DataTableColumn]
    rows: list[dict[str, str]] = []

    @field_validator("columns")
    @classmethod
    def validate_columns(cls, v: list[DataTableColumn]) -> list[DataTableColumn]:
        if len(v) < 1:
            raise ValueError("至少需要 1 列")
        keys = [col.key for col in v]
        if len(keys) != len(set(keys)):
            raise ValueError("列 key 不可重复")
        return v


# ===== external_links =====


class ExternalLinkItem(BaseModel):
    title: str
    url: str
    date: str | None = None
    source: str | None = None


class ExternalLinksContent(BaseModel):
    items: list[ExternalLinkItem] = []


# ===== video =====


class VideoItem(BaseModel):
    title: str
    url: str
    poster: str | None = None


class VideoContent(BaseModel):
    items: list[VideoItem] = []


# ===== metric_cards =====


class MetricCardItem(BaseModel):
    label_zh: str
    label_en: str = ""
    value: str          # "ρ=0.936", "100%", "δ=0.852"
    detail_zh: str = ""
    detail_en: str = ""


class MetricCardsContent(BaseModel):
    cards: list[MetricCardItem] = []

    @field_validator("cards")
    @classmethod
    def validate_cards(cls, v: list[MetricCardItem]) -> list[MetricCardItem]:
        if len(v) > 6:
            raise ValueError("最多 6 张指标卡片")
        return v


# ===== timeline =====


class TimelineItem(BaseModel):
    date_start: str             # "2001-09" or "2001"
    date_end: str | None = None # None = 至今
    title_zh: str
    title_en: str = ""
    subtitle_zh: str = ""
    subtitle_en: str = ""
    description_zh: str = ""
    description_en: str = ""
    category: str = "milestone"  # education, career, research, community, milestone
    icon: str | None = None     # lucide icon name


class TimelineContent(BaseModel):
    items: list[TimelineItem] = []
    layout: str = "vertical"     # "vertical" | "horizontal"

    @field_validator("layout")
    @classmethod
    def validate_layout(cls, v: str) -> str:
        if v not in ("vertical", "horizontal"):
            raise ValueError("layout 必须为 vertical 或 horizontal")
        return v


# ===== profile_hero =====


class SocialLink(BaseModel):
    platform: str       # "email", "github", "google_scholar", "orcid", etc.
    url: str
    label: str = ""

class CTAButton(BaseModel):
    label_zh: str
    label_en: str = ""
    url: str


class ProfileHeroContent(BaseModel):
    avatar_url: str = ""
    # CSS object-position for the circular avatar crop, e.g. "50% 20%".
    avatar_position: str = "50% 50%"
    name_zh: str = ""
    name_en: str = ""
    tagline_zh: str = ""
    tagline_en: str = ""
    mission_zh: str = ""
    mission_en: str = ""
    tags: list[str] = []        # ["AI+Education", "AI+Psychology", ...]
    social_links: list[SocialLink] = []
    cta_buttons: list[CTAButton] = []


# ===== cta_band =====


class CtaBandContent(BaseModel):
    description_zh: str = ""
    description_en: str = ""
    buttons: list[CTAButton] = []   # 复用 profile_hero 的 CTAButton 结构


# ===== 类型分发 =====

CONTENT_SCHEMA_MAP: dict[str, type[BaseModel]] = {
    "rich_text": RichTextContent,
    "image_gallery": ImageGalleryContent,
    "data_table": DataTableContent,
    "external_links": ExternalLinksContent,
    "video": VideoContent,
    "metric_cards": MetricCardsContent,
    "timeline": TimelineContent,
    "profile_hero": ProfileHeroContent,
    "cta_band": CtaBandContent,
}

DEFAULT_CONTENT_MAP: dict[str, dict] = {
    "rich_text": {"body": ""},
    "image_gallery": {"columns": 4, "page_size": 8, "items": []},
    "data_table": {"columns": [{"key": "col1", "title": "列1"}], "rows": []},
    "external_links": {"items": []},
    "video": {"items": []},
    "metric_cards": {"cards": []},
    "timeline": {"items": [], "layout": "vertical"},
    "profile_hero": {"avatar_url": "", "avatar_position": "50% 50%", "name_zh": "", "name_en": "", "tagline_zh": "", "tagline_en": "", "tags": [], "social_links": [], "cta_buttons": []},
    "cta_band": {"description_zh": "", "description_en": "", "buttons": []},
}


def validate_content(section_type: str, content: dict) -> dict:
    """校验 content 并返回标准化后的 dict。"""
    schema_cls = CONTENT_SCHEMA_MAP.get(section_type)
    if not schema_cls:
        raise ValueError(f"未知区块类型: {section_type}")
    validated = schema_cls(**content)
    return validated.model_dump()
