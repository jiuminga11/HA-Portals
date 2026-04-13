"""Initialize database with default pages and sample sections."""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal, Base  # noqa: E402
from app.models import Page, Section, SiteConfig  # noqa: E402


def seed() -> None:
    """Seed the database with 6 default pages and sample sections."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Page).count() > 0:
            print("Database already seeded. Skipping.")
            return

        # Create 6 default pages
        pages = [
            Page(
                slug="home",
                title_zh="首页",
                title_en="Home",
                meta_description_zh="",
                meta_description_en="",
                sort_order=0,
                visible=True,
            ),
            Page(
                slug="about",
                title_zh="关于",
                title_en="About",
                meta_description_zh="",
                meta_description_en="",
                sort_order=1,
                visible=True,
            ),
            Page(
                slug="research",
                title_zh="研究",
                title_en="Research",
                meta_description_zh="研究方向与成果",
                meta_description_en="Research Directions and Outcomes",
                sort_order=2,
                visible=True,
            ),
            Page(
                slug="projects",
                title_zh="项目",
                title_en="Projects",
                meta_description_zh="项目与实践",
                meta_description_en="Projects and Practice",
                sort_order=3,
                visible=True,
            ),
            Page(
                slug="honors",
                title_zh="荣誉",
                title_en="Honors",
                meta_description_zh="荣誉与影响力",
                meta_description_en="Honors and Impact",
                sort_order=4,
                visible=True,
            ),
            Page(
                slug="cv",
                title_zh="简历",
                title_en="CV",
                meta_description_zh="在线简历",
                meta_description_en="Online CV",
                sort_order=5,
                visible=True,
            ),
        ]
        db.add_all(pages)
        db.flush()  # Get IDs

        # --- Home page sections ---
        home = pages[0]
        home_sections = [
            Section(
                page_id=home.id,
                title_zh="个人简介",
                title_en="Profile",
                type="profile_hero",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "avatar_url": "",
                        "name_zh": "",
                        "name_en": "",
                        "tagline_zh": "",
                        "tagline_en": "",
                        "mission_zh": "",
                        "mission_en": "",
                        "tags": [],
                        "social_links": [
                            {
                                "platform": "email",
                                "url": "mailto:example@example.com",
                                "label": "Email",
                            }
                        ],
                        "cta_buttons": [
                            {
                                "label_zh": "查看研究",
                                "label_en": "View Research",
                                "url": "/research",
                            },
                            {
                                "label_zh": "下载简历",
                                "label_en": "Download CV",
                                "url": "/cv",
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=home.id,
                title_zh="研究亮点",
                title_en="Research Highlights",
                type="metric_cards",
                sort_order=1,
                visible=True,
                content=json.dumps(
                    {
                        "cards": []
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=home.id,
                title_zh="个人经历",
                title_en="Journey",
                type="timeline",
                sort_order=2,
                visible=True,
                content=json.dumps(
                    {
                        "items": [],
                        "layout": "vertical",
                    },
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(home_sections)

        # --- About page sections ---
        about = pages[1]
        about_sections = [
            Section(
                page_id=about.id,
                title_zh="我的故事",
                title_en="My Story",
                type="rich_text",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "body": ""
                    },
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(about_sections)

        # --- Research page sections ---
        research = pages[2]
        research_sections = [
            Section(
                page_id=research.id,
                title_zh="CSPA 过程框架",
                title_en="CSPA Process Framework",
                type="rich_text",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "body": ""
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=research.id,
                title_zh="验证数据",
                title_en="Validation Results",
                type="metric_cards",
                sort_order=1,
                visible=True,
                content=json.dumps(
                    {
                        "cards": []
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=research.id,
                title_zh="论文",
                title_en="Publications",
                type="data_table",
                sort_order=2,
                visible=True,
                content=json.dumps(
                    {
                        "columns": [
                            {"key": "title", "title": "标题", "bold": True},
                            {"key": "venue", "title": "期刊/会议"},
                            {"key": "status", "title": "状态"},
                            {"key": "year", "title": "年份", "width": 80, "align": "center"},
                        ],
                        "rows": [],
                    },
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(research_sections)

        # --- Projects page sections ---
        projects = pages[3]
        projects_sections = [
            Section(
                page_id=projects.id,
                title_zh="项目展示",
                title_en="Project Showcase",
                type="rich_text",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "body": ""
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=projects.id,
                title_zh="项目列表",
                title_en="Project List",
                type="data_table",
                sort_order=1,
                visible=True,
                content=json.dumps(
                    {
                        "columns": [
                            {"key": "name", "title": "项目", "bold": True},
                            {"key": "period", "title": "时间"},
                            {"key": "desc", "title": "简介"},
                            {"key": "result", "title": "成果"},
                        ],
                        "rows": [],
                    },
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(projects_sections)

        # --- Honors page sections ---
        honors = pages[4]
        honors_sections = [
            Section(
                page_id=honors.id,
                title_zh="学术科研",
                title_en="Academic Research",
                type="data_table",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "columns": [
                            {"key": "year", "title": "年份", "width": 80, "align": "center"},
                            {"key": "honor", "title": "荣誉", "bold": True},
                        ],
                        "rows": [],
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=honors.id,
                title_zh="服务实践",
                title_en="Service & Practice",
                type="data_table",
                sort_order=1,
                visible=True,
                content=json.dumps(
                    {
                        "columns": [
                            {"key": "year", "title": "年份", "width": 80, "align": "center"},
                            {"key": "honor", "title": "荣誉", "bold": True},
                        ],
                        "rows": [],
                    },
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(honors_sections)

        # --- CV page sections ---
        cv = pages[5]
        cv_sections = [
            Section(
                page_id=cv.id,
                title_zh="教育背景",
                title_en="Education",
                type="data_table",
                sort_order=0,
                visible=True,
                content=json.dumps(
                    {
                        "columns": [
                            {"key": "period", "title": "时间", "width": 120},
                            {"key": "school", "title": "学校", "bold": True},
                            {"key": "major", "title": "专业"},
                            {"key": "degree", "title": "学位"},
                        ],
                        "rows": [],
                    },
                    ensure_ascii=False,
                ),
            ),
            Section(
                page_id=cv.id,
                title_zh="联系方式",
                title_en="Contact",
                type="rich_text",
                sort_order=1,
                visible=True,
                content=json.dumps(
                    {"body": ""},
                    ensure_ascii=False,
                ),
            ),
        ]
        db.add_all(cv_sections)

        # --- SiteConfig ---
        existing_config = db.query(SiteConfig).filter(SiteConfig.id == 1).first()
        if not existing_config:
            config = SiteConfig(
                id=1,
                site_title="HA-PORTALS",
                project_title="HA-PORTALS",
                footer_text="© 2026 HA-PORTALS",
                primary_color="#0D9488",
                gradient_color="#D97706",
                accent_color="#059669",
                theme_preset="teal-amber",
                font_size="standard",
                default_theme="system",
                default_locale="zh",
                seo_default_title_zh="",
                seo_default_title_en="",
            )
            db.add(config)

        db.commit()
        print("Database seeded successfully with 6 pages and sample sections.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
