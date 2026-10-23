# 执行记录（2026-10-23）

- `init_fixture.py baseline`：退出 1，Path.open 不支持 opener；已修正。遗留空目录未覆盖。
- `init_fixture.py baseline-v1`：退出 0；后续运行环境为此名称。
- focused 初跑：退出 1，修正 execve argv[0] 的虚拟环境识别、unittest 的 run 属性冲突。
- focused 再跑：退出 1；并行应用整改已收紧 reorder 输入为连续顺序，测试改用有效连续请求，仍检查持久化、连续多次排序、删除归一化与非法请求无副作用。
- `npm exec vite build -- --outDir ../.remediation-runtime/baseline-v1/dist`（frontend）：退出 0。
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backend/tests -p test_remediation.py -v`：最终退出 0，5 tests passed。每次独立数据库，服务自动退出。
- `python3 scripts/remediation/smoke.py`：退出 0；/ha/ 静态/deep-link、API、六页、PNG CRC/像素流解码、文本下载、隐藏页/缺失资产 404。
- 后台服务保留：`PYTHONDONTWRITEBYTECODE=1 python3 scripts/remediation/serve.py baseline-v1`（18002），`PYTHONDONTWRITEBYTECODE=1 python3 scripts/remediation/preview.py baseline-v1`（15174）。长运行服务未退出，不记录伪造退出码。
- 停止方法见 README，将示例 `baseline` 换成 `baseline-v1`，先检查 PID。
- 日志、DB、uploads、dist、截图目录全在 `.remediation-runtime/`，已确认 git ignored。无应用代码改动，无私有数据读取或 seed 使用。
- 未执行：最终浏览器矩阵、交互验收、TypeScript/ESLint、完整后端测试；由主会话负责。本次构建使用当时工作树（其他代理并行修改），不是固定历史提交证据。
