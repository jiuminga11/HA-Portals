# 协作交接队列（HANDOFF）

## 协作开关

- `antigravity_mode: disabled`

反重力当前不可用。所有工作在 OpenCode 内完成。

## 最新交接：前端展示与业务逻辑整改（2026-10-23）

- **新会话入口**：[REMEDIATION_HANDOFF.md](REMEDIATION_HANDOFF.md)。该文件包含完整整改范围、优先级、验证要求及可直接使用的启动提示词。
- **代码基线**：`dev` 分支，评审时为 `a81833b`；本次交接不实施应用整改。
- **评审方式**：当前源码与本地数据库只读检查，六个公开页面的 24 张手机/桌面、深浅主题截图，后台保存和排序请求拦截验证。不是线上验收，没有修改业务数据。
- **主要阻断项**：英文标题保存覆盖、后台排序显示不同步、区块默认归属页面、简历下载路径缺失、英文访问路径不完整、手机 CV 长邮箱溢出。
- **本地补充材料**：`.omo/reviews/frontend-business-20261023/`（被 Git 忽略，不保证新克隆存在）；可执行整改要求已整合进根目录交接文件，不依赖这些本地材料。
- **数据边界**：密钥、运行数据库、上传目录、临时日志及截图不进入 Git。新环境的真实内容和媒体需要另行安全恢复，不能用 seed 覆盖现有数据库。
- **验证基线**：前端 TypeScript 检查通过；ESLint 有 3 个既有错误；未执行生产构建或完整后端测试。

## 当前状态

项目已完成需求分析阶段（4 轮 Oracle 审核通过），进入实施阶段。

### 关键文档

| 文档 | 路径 | 状态 |
|---|---|---|
| 内容需求 v2.0 | `docs/content-requirements.md` | ✅ Oracle GO |
| 功能需求 v2.0 | `docs/functional-requirements.md` | ✅ Oracle GO |
| 实施计划 | `.sisyphus/plans/personal-website-plan.md` | ✅ 已更新 |
| AGENTS.md | `AGENTS.md` | ✅ 已更新 |

### 技术架构

React 19 + Vite + FastAPI + SQLite，fork 自 PSY OF XXMU。

### 部署路径

1. 当前：国内服务器，IP 直连，端口 8002
2. 长期：海外服务器 + 自有域名
3. 备选：Sealos 容器化

---

## 已归档任务

| handoff_id | 状态 | 说明 |
|---|---|---|
| handoff_20260413_01~03 | archived | 原 Next.js 静态导出方案的前端 handoff，架构已切换为 FastAPI+SQLite，任务作废 |

## 评审记录

| 日期 | 报告 | 总评 |
|------|------|------|
| 2026-05-08 | 本地归档 于 `docs/reviews/`（`docs/` 在 .gitignore 中，不推送到远程） | C+ / 及格偏弱（前端 76.5、后端 72、运维 ★★★☆☆）。代码质量好但运维基础设施薄弱：无备份、无监控、无 Alembic、文档与实现脱节。已按 P0/P1 完成 commit b108e63 + 后续增量修复。 |
