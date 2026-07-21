"""SQLAlchemy ORM 模型。"""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)

from app.database import Base


class SiteConfig(Base):
    """站点全局配置，始终只有一条记录（id=1）。"""

    __tablename__ = "site_config"

    id: int = Column(Integer, primary_key=True, default=1)
    site_title: str = Column(String(200), nullable=False, default="")
    project_title: str = Column(String(500), nullable=False, default="")
    logo_url: str | None = Column(String(500), nullable=True)
    banner_url: str | None = Column(String(500), nullable=True)
    footer_text: str = Column(String(500), nullable=False, default="")
    primary_color: str = Column(String(20), nullable=False, default="#4F46E5")
    gradient_color: str = Column(String(20), nullable=False, default="#7C3AED")
    accent_color: str = Column(String(20), nullable=False, default="#F59E0B")
    theme_preset: str = Column(
        String(50), nullable=False, default="teal-amber"
    )
    font_size: str = Column(String(20), nullable=False, default="standard")
    default_theme: str = Column(String(20), nullable=False, default="system")
    default_locale: str = Column(String(10), nullable=False, default="zh")
    seo_default_title_zh: str = Column(
        String(200),
        nullable=False,
        default="",
    )
    seo_default_title_en: str = Column(
        String(200),
        nullable=False,
        default="",
    )
    seo_default_description_zh: str = Column(String(500), nullable=False, default="")
    seo_default_description_en: str = Column(String(500), nullable=False, default="")
    seo_og_image: str | None = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Page(Base):
    """页面，每个 Page 包含多个 Section。"""

    __tablename__ = "page"
    __table_args__ = (Index("idx_page_sort", "visible", "sort_order"),)

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    slug: str = Column(String(100), nullable=False, unique=True)
    title_zh: str = Column(String(200), nullable=False)
    title_en: str = Column(String(200), nullable=False, default="")
    meta_description_zh: str = Column(String(500), nullable=False, default="")
    meta_description_en: str = Column(String(500), nullable=False, default="")
    sort_order: int = Column(Integer, nullable=False, default=0)
    visible: bool = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Section(Base):
    """内容区块，每条记录对应前台展示页的一个板块。"""

    __tablename__ = "section"
    __table_args__ = (
        CheckConstraint(
            "type IN ('rich_text', 'image_gallery', 'data_table', 'external_links', 'video', 'metric_cards', 'timeline', 'profile_hero', 'cta_band')",
            name="ck_section_type",
        ),
        Index("idx_section_sort", "page_id", "visible", "sort_order"),
    )

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    page_id: int = Column(Integer, ForeignKey("page.id", ondelete="CASCADE"), nullable=False)
    title_zh: str = Column(String(200), nullable=False)
    title_en: str = Column(String(200), nullable=False, default="")
    type: str = Column(String(50), nullable=False)
    sort_order: int = Column(Integer, nullable=False, default=0)
    visible: bool = Column(Boolean, nullable=False, default=True)
    content: str = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class UploadedFile(Base):
    """文件上传记录。"""

    __tablename__ = "uploaded_file"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    filename: str = Column(String(255), nullable=False)
    stored_name: str = Column(String(255), nullable=False, unique=True)
    file_path: str = Column(String(500), nullable=False)
    file_url: str = Column(String(500), nullable=False)
    file_size: int = Column(Integer, nullable=False)
    mime_type: str = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
