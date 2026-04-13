---
description: 执行 HANDOFF.md 中指定的交接任务
---

1. 先读取 `AGENTS.md` 中的 `MULTI-CLIENT PROTOCOL`。
2. 再读取根目录 `HANDOFF.md`。
3. 检查 `HANDOFF.md` 中 `antigravity_mode` 是否为 `enabled`；如果为 `disabled`，停止并通知用户。
4. 根据用户明确指定的 `handoff_id` 找到对应条目；如果用户没有指定，不要自行猜测或挑选任务。
5. 检查该条目是否属于 `Antigravity` 当前处理范围；如果不属于，则停止并说明原因。
6. 若状态尚未进入执行中，则把该条目更新为 `in_progress`，并在 `activity_log` 中注明开始处理。
7. 按照条目中的 `scope`、`inputs`、`expected_output` 执行任务；不要擅自扩展到无关任务。
8. 完成后更新该条目的以下字段：
   - `status: returned`
   - `result_summary`
   - `output_paths`（如有文件产出）
   - `opencode_action_required`
   - `opencode_action_tags`
   - `opencode_handoff_back_command`（若需要 OpenCode 接手）
   - `activity_log` 或 `blocked_log`
9. 若执行中被卡住，不要伪造完成；按 `BLOCKED` 规范写回 `HANDOFF.md`。
10. 通知用户结果，等待 `OpenCode` 吸收，不要自行代替 `OpenCode` 完成正式仓库收口。

补充规则：

- 这个 workflow 只是便捷入口，不替代 `AGENTS.md` 与 `HANDOFF.md` 的正式协议。
- 如果项目相关工作是直接在 `Antigravity` 中发起的，也仍应按 `HANDOFF.md` 的最小回写规范补一条返回记录。
