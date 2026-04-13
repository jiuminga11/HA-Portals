# 协作交接队列（HANDOFF）

## 协作开关

- `antigravity_mode: disabled`

反重力当前不可用。所有工作在 OpenCode 内完成。

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
