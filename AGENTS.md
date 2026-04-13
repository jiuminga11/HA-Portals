# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-13
**Branch:** main

## OVERVIEW

HA-PORTALS — 个人学术与职业作品集网站。React 19 + Vite + FastAPI + SQLite 全栈 CMS 架构，复用 PSY OF XXMU 的 Section-based 内容管理系统。支持中英双语、暗色/亮色主题、11 种 Section 类型、Admin 管理后台。部署在自有 Linux + Nginx 服务器。

## REFERENCE PROJECT

本项目基于 PSY OF XXMU（省级教学成果奖展示 CMS）架构扩展：
- 核心复用：Section 模型 + content_schemas + SectionRenderer + Admin 面板 + deploy 流程
- 核心复用：Section 模型 + content_schemas + SectionRenderer + Admin 面板 + deploy 流程

## STRUCTURE

```
HA-PORTALS/
├── backend/
│   └── app/
│       ├── main.py               # FastAPI 入口
│       ├── config.py             # 环境变量配置
│       ├── database.py           # SQLAlchemy 初始化
│       ├── models.py             # Page, Section, SiteConfig, UploadedFile
│       ├── schemas.py            # Pydantic 请求/响应模型
│       ├── content_schemas.py    # 11 种 Section type 的 content 校验
│       ├── deps.py               # JWT auth 依赖
│       ├── routers/
│       │   ├── auth.py
│       │   ├── pages.py          # 多页面管理（新增）
│       │   ├── sections.py       # Section CRUD + 排序
│       │   ├── site_config.py
│       │   └── upload.py
│       └── data/                 # SQLite DB + seed
├── frontend/
│   └── src/
│       ├── api/                  # API client
│       ├── components/
│       │   ├── display/          # Section 展示组件 + SectionRenderer
│       │   ├── editor/           # Section 编辑组件（Admin）
│       │   ├── layout/           # Header, Footer, ThemeToggle, LanguageSwitcher
│       │   └── common/
│       ├── pages/
│       │   ├── public/           # Home, About, Research, Projects, Honors, CV
│       │   └── admin/            # Dashboard, SectionEditor, SiteSettings, FileManager, PageManager
│       ├── hooks/
│       ├── locales/              # i18n JSON（zh.json / en.json）— UI 文本
│       ├── types/
│       └── styles/
├── deploy/
│   ├── nginx.conf
│   ├── ha-portals.service
│   └── deploy.sh
├── docs/
│   ├── content-requirements.md   # 内容需求（v2.0）
│   └── functional-requirements.md # 功能需求（v2.0）
├── .sisyphus/plans/
└── HANDOFF.md
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new Section type | `backend/app/content_schemas.py` + `frontend/src/types/` + `display/` + `editor/` | 复用 PSY OF XXMU 模式 |
| Change API behavior | `backend/app/routers/` | sections.py 最复杂 |
| Change visual theme | `frontend/src/styles/` | CSS 变量，3 套主题预设 |
| Change admin UI | `frontend/src/pages/admin/` | 复用 PSY OF XXMU 管理面板 |
| Change public display | `frontend/src/components/display/` | SectionRenderer 按 type 分发 |
| Auth logic | `backend/app/deps.py` | JWT，复用 PSY OF XXMU |
| File uploads | `backend/app/routers/upload.py` | UUID 重命名，引用检查删除 |
| i18n UI text | `frontend/src/locales/` | zh.json / en.json |
| Deploy | `deploy/deploy.sh` | Nginx + systemd，复用 PSY OF XXMU 模式 |
| Requirements | `docs/` | content-requirements.md + functional-requirements.md |

## CONVENTIONS

- **Section-based CMS**：所有内容以 Section 为单位存储在 SQLite 中，通过 Admin 后台管理
- **复用 PSY OF XXMU 的 5 种 Section 类型**：rich_text, image_gallery, data_table, external_links, video — schema 字段完全一致
- **双语分层管理**：UI 文本 → 前端 i18n JSON；Section 标题 → DB `title_zh`/`title_en`；Section content → 继承 PSY OF XXMU 单语 schema
- **页面可见性**：由 `Page.visible` 统一管控（导航显示 + API 返回 + URL 可访问性）
- **主题**：3 套配色预设（Teal+Amber / Deep Indigo+Sage / Forest+Terracotta），CSS 变量实现
- **动效**：Framer Motion 微动效（入场/hover/过渡），保持克制
- **字体**：Inter + Noto Sans SC + Noto Serif SC + JetBrains Mono（Google Fonts 国内 CDN，fallback 系统字体）
- **Backend**：Pydantic v2 语法，所有路由用 HTTPException
- **Frontend**：TypeScript 严格模式，Discriminated union types for Section
- **Auth**：username/password → JWT，两级权限（和 PSY OF XXMU 一致）
- **Sort order**：每次创建/删除/重排后归一化到 0..n-1

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `as any` / `@ts-ignore` / `@ts-expect-error`
- **NEVER** suppress type errors or empty catch blocks
- **NEVER** hardcode 中文或英文文本到组件中（UI 文本通过 i18n JSON，内容通过 DB）
- **NEVER** use CSS-in-JS（使用 Tailwind + CSS 变量）
- **NEVER** import Next.js 相关包（本项目使用 React + Vite，不是 Next.js）
- **NEVER** 修改继承的 5 种 Section content schema 字段结构

## COMMANDS

```bash
# Backend dev
cd backend && uvicorn app.main:app --reload --port 8002

# Frontend dev
cd frontend && npm run dev

# Frontend build
cd frontend && npm run build

# Type check (frontend)
cd frontend && npx tsc --noEmit

# Deploy
bash deploy/deploy.sh
```

## SAFETY BOUNDARIES

- **Working scope limited to** `/home/admin/WorkSpace/project/HA-PORTALS/` directory only
- **NEVER modify system files**
- **NEVER use sudo** (deploy.sh 内部的 sudo 除外)

## MULTI-CLIENT PROTOCOL

**antigravity_mode: disabled**

反重力（Antigravity）当前不可用。所有工作在 OpenCode 内完成。

待反重力恢复后，可重新启用协作模式：
- 前端实现（React/Tailwind）→ Antigravity
- Git 操作、部署配置、验证 → OpenCode
- 架构决策、代码审核 → OpenCode + Oracle
