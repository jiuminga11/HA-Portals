# HA-PORTALS

HA-PORTALS 是一个个人学术与职业作品集网站，面向申博、求职和个人成果展示场景。项目采用 React 19 + Vite + FastAPI + SQLite 的全栈 CMS 架构，以 Section-based 内容管理为核心，支持中英双语、暗色/亮色主题、文件上传、页面可见性管理和 Admin 后台维护。

## 项目特性

- **统一个人主页**：以首页作为唯一对外入口，通过 CTA 引导访客进入 Research、Projects、CV 等页面。
- **Section-based CMS**：页面内容由可排序、可隐藏的 Section 组成，后端按 Section type 校验 content schema，前端通过 SectionRenderer 分发渲染。
- **中英双语**：中文为默认语言，英文使用 `/en/` 路由前缀；UI 文本由前端 i18n 管理，内容字段由数据库维护。
- **主题与响应式布局**：支持亮色/暗色主题、CSS 变量主题预设和移动端适配。
- **Admin 管理后台**：提供页面管理、Section 编辑、站点配置、文件上传与管理等能力。
- **自托管部署**：通过 Nginx location snippet + systemd service 部署到自有 Linux 服务器。

## 技术栈

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Headless UI

### Backend

- FastAPI
- SQLAlchemy
- Pydantic v2 / pydantic-settings
- SQLite
- JWT 鉴权
- Uvicorn

## 目录结构

```text
HA-PORTALS/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI 入口与路由注册
│   │   ├── config.py             # 环境变量配置
│   │   ├── database.py           # SQLAlchemy 初始化
│   │   ├── models.py             # Page / Section / SiteConfig / UploadedFile
│   │   ├── schemas.py            # Pydantic 请求与响应模型
│   │   ├── content_schemas.py    # Section content schema 校验
│   │   └── routers/              # auth / pages / sections / site_config / upload
│   ├── data/                     # SQLite 数据库与 seed 数据
│   ├── uploads/                  # 上传文件目录
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                  # API client
│   │   ├── components/           # display / editor / layout / common
│   │   ├── pages/                # public / admin 页面
│   │   ├── hooks/
│   │   ├── locales/              # zh.json / en.json
│   │   ├── styles/
│   │   └── types/
│   └── package.json
├── deploy/
│   ├── deploy.sh                 # 部署脚本
│   ├── ha-portals.service        # systemd 服务配置
│   └── nginx.conf                # Nginx location snippet
└── docs/
    ├── content-requirements.md
    └── functional-requirements.md
```

## 本地开发

### 1. 准备后端环境

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `backend/.env`，至少修改以下两项：

```env
ADMIN_PASSWORD=your-secure-password
JWT_SECRET_KEY=your-random-secret-key
```

默认开发配置：

```env
DATABASE_URL=sqlite:///./data/ha-portals.db
UPLOAD_DIR=uploads
CORS_ORIGINS=["http://localhost:5174"]
```

启动后端：

```bash
uvicorn app.main:app --reload --port 8002
```

### 2. 准备前端环境

```bash
cd frontend
npm install
npm run dev
```

前端开发服务默认运行在：

```text
http://localhost:5174
```

Vite 开发服务器会将 `/api` 和 `/uploads` 代理到 `http://localhost:8002`。

## 常用命令

### 后端

```bash
cd backend
uvicorn app.main:app --reload --port 8002
```

### 前端

```bash
cd frontend
npm run dev       # 启动开发服务器
npm run build     # TypeScript 构建 + Vite 生产构建
npm run lint      # ESLint 检查
npm run preview   # 预览生产构建
```

## 部署

部署工具默认只读检查，不会安装依赖、初始化数据库或修改服务：

```bash
bash deploy/deploy.sh
```

实际发布必须另行授权并显式传入 `--apply`，使用预先核验的 operator 和独立候选目录。工具不执行 seed，不安装或修改系统服务；在停写确认后备份 SQLite 与上传文件，保留旧代码、前端产物和依赖，并检查 HTTP 及健康 JSON。默认代码回滚不恢复数据库；恢复数据有独立的数据丢失确认门槛。

完整前置条件、命令、沙箱覆盖与回滚限制见 [deploy/README.md](deploy/README.md)。本轮仅做项目内沙箱验证，不等于已通过生产部署验收。

生产环境路径：

```text
前台访问: /ha/
后台管理: /ha/admin
API 入口: /ha/api/
上传文件: /ha/uploads/
后端服务: http://127.0.0.1:8002
```

> `deploy/nginx.conf` 是 location snippet，需要被已有 Nginx server 块 include，不能直接作为完整 server 配置使用。

## 一键隔离验收

```bash
python3 scripts/remediation/verify.py                 # 核心业务验收
python3 scripts/remediation/verify.py --profile full  # 完整浏览器、安全、无障碍与部署沙箱
```

从零生成隔离数据库、上传目录和测试凭据，使用动态端口及外置生产构建，不读取真实运行数据，也不占用正常的 5174/8002 服务。默认结束后清理自身进程与敏感测试目录，只保留经过白名单筛选的报告和合成截图。

环境、覆盖范围、排障与报告路径见 [VERIFICATION.md](VERIFICATION.md)。GitHub Actions 在 `dev/main` 推送、PR 和手动触发时运行同一入口；不使用生产或部署密钥。

## 内容管理模型

核心数据模型围绕 Page 和 Section 展开：

- `Page`：定义页面 slug、标题、SEO 元信息和可见性。
- `Section`：定义页面内的内容区块，包含双语标题、类型、排序、可见性和 JSON content。
- `SiteConfig`：维护站点级配置。
- `UploadedFile`：记录上传文件及引用状态。

当前 CMS 已实现 8 种 Section 类型：

- `rich_text`
- `image_gallery`
- `data_table`
- `external_links`
- `video`
- `metric_cards`
- `timeline`
- `profile_hero`

需求文档中还规划了以下近期补充类型，落地前需要同步更新前后端 schema、编辑器和展示组件：

- `card_grid`
- `wechat_video`
- `download`

新增 Section 类型时，通常需要同步更新：

1. `backend/app/content_schemas.py`
2. `frontend/src/types/`
3. `frontend/src/components/display/`
4. `frontend/src/components/editor/`

## 文档

- `docs/content-requirements.md`：网站定位、受众、页面内容与叙事线。
- `docs/functional-requirements.md`：功能分层、技术方案和验收标准。

## 开发约定

- UI 文本不要硬编码到组件中，统一维护在 `frontend/src/locales/`。
- 内容文本通过数据库和 Section content 管理。
- TypeScript 保持严格类型，不使用 `as any`、`@ts-ignore` 或 `@ts-expect-error`。
- 后端路由统一使用 `HTTPException` 返回用户可理解的错误。
- Section 创建、删除和重排后需要保持 `sort_order` 归一化。
- 继承自 PSY OF XXMU 的 Section content schema 字段结构不要随意修改。
