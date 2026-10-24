# 隔离整改验证

新的可重复验收入口：`python3 scripts/remediation/verify.py`（core），或加 `--profile full`。
详细环境接口、动态端口、安全清理、CI artifact 白名单见根目录 `VERIFICATION.md`。
下文保留的是手工/历史 baseline 操作说明，不是新 runner 的默认数据源。

默认合成验证不读取 seed、私有 DB/uploads 或 backend/.env。每个 run 从零合成；已有目录拒绝覆盖。末尾的可选只读验收是单独入口，不参与写入测试。
密码/JWT 在 run 内 0600 `secrets.json`，不要打印或提交。运行目录必须保持 git ignored。
根 AGENTS 与 REMEDIATION_HANDOFF 已读；backend/AGENTS.md 不存在，遵循 backend/app/AGENTS.md。

从仓库根目录执行（baseline 可换 batch1/batch2/batch3）：

```sh
backend/.venv/bin/python scripts/remediation/init_fixture.py baseline
# 仅构建产物写 runtime，不修改应用源文件；生产 base 来自 vite.config.ts
cd frontend
npm exec vite build -- --outDir ../.remediation-runtime/baseline/dist > ../.remediation-runtime/baseline/build.log 2>&1
cd ..
python3 scripts/remediation/serve.py baseline
# 另一个终端 / 后台工具
python3 scripts/remediation/preview.py baseline
```

预览 `http://127.0.0.1:15174/ha/`；API 18002；代理仅 `/ha/api/` 和 `/ha/uploads/`。
故意不兼容根 `/uploads/`，使媒体 base 错误可复现。SPA 深链回退 index；不存在静态文件返回 404。
重新构建相同 outDir 即可测后续版本；重启 serve 加载后端更新。
支持并行前后版本（共用隔离 API，不读取真实数据）：

```sh
python3 scripts/remediation/preview.py baseline-v1 --dist .remediation-runtime/baseline-dist --port 15175
python3 scripts/remediation/preview.py baseline-v1 --dist .remediation-runtime/baseline-v1/dist --port 15174
```

`--dist` 相对当前工作目录解析，只允许 `.remediation-runtime/` 内目录。
15174 保持 `preview.pid/preview.log`；其他端口使用 `preview-15175.pid/preview-15175.log`，停止时检查并使用对应 PID，避免覆盖。
启动服务应使用后台工具；日志/PID 写 run 内。停止前验证 PID 对应命令：

```sh
python3 -c 'import pathlib,subprocess; r=pathlib.Path(".remediation-runtime/baseline"); [subprocess.run(["ps","-p",(r/f).read_text(),"-o","pid,args"]) for f in ["backend.pid","preview.pid"]]'
python3 -c 'import pathlib,os,signal; r=pathlib.Path(".remediation-runtime/baseline"); [os.kill(int((r/f).read_text()),signal.SIGTERM) for f in ["backend.pid","preview.pid"]]'
```

API focused 回归（自建唯一 run、随机端口真实 uvicorn，结束自动停服务，不影响浏览器 fixture）：

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backend/tests -p test_remediation.py -v
```

六页 ID 1..6：home/about/research/projects/honors/cv；隐藏页 7=test-hidden。
区块 ID 见 run/manifest.json；中英文标题不同，同页多个区块，隐藏区块、长邮箱、长表格、裁切头像、图库。
两张 PNG 为标准库生成可解码色块；test-download.txt 明确测试且不是 CV，不提供冒充简历 PDF。
合成正文保持继承 schema 单语，不伪造翻译/事实。所有可见标题文案标记测试。
浏览器调用登录时直接读取 secrets.json，绝不 console.log 密码/token；截图写 run/screenshots。
浏览器最终验收由主会话负责；API 测试通过不代表编辑器交互或生产线上通过。

## 本次可重复验收入口

浏览器脚本固定使用 `baseline-v1` 和本地 15174，请在新克隆中将上述创建/构建/启动命令的 run 名替换为 `baseline-v1`。若目录已经存在，**直接复用，不重新初始化、不覆盖 DB**。基线截图脚本另外需要 15175 的基线预览；后续公开页面脚本不需要基线产物。

```sh
# 仓库根目录；全套后端使用虚拟环境以包含 SQLAlchemy/FastAPI
backend/.venv/bin/python -m unittest discover -s backend/tests -v
node scripts/remediation/routing-test.cjs
node scripts/remediation/auth-test.cjs
node scripts/remediation/content-test.cjs

# 完整生产构建后复制新产物到已隔离的预览目录
(cd frontend && npm run lint && npm run build)
cp -a frontend/dist/. .remediation-runtime/baseline-v1/dist/

node scripts/remediation/browser-pass1.cjs
node scripts/remediation/browser-public.cjs pass2
node scripts/remediation/browser-reading.cjs
node scripts/remediation/contrast.cjs

# 第三批实际后台写入只操作合成 fixture；请串行运行以便准确恢复
node scripts/remediation/browser-states.cjs
node scripts/remediation/browser-admin.cjs
node scripts/remediation/browser-settings-files.cjs
node scripts/remediation/browser-gate.cjs
node scripts/remediation/browser-avatar.cjs
REMEDIATION_PASS=pass3-core node scripts/remediation/browser-pass1.cjs --functional-only
node scripts/remediation/browser-public.cjs pass3
```

浏览器使用本机 Playwright、`/usr/bin/google-chrome`；对比度脚本另需 `python3` 的 Pillow。未将它们新增为应用依赖；缺失时应报告环境缺口，不宣称浏览器检查完成。截图强制展开 reveal 并结束动画，只验证稳定态，不验证动效。

## 可选：现有内容只读尺寸验收

此入口仅在本地存在原数据库时使用，不生成/更新任何业务数据。`serve_readonly.py` 强制 SQLite `mode=ro`、禁用 lifespan、只接受 GET/HEAD，并屏蔽管理/认证/文件列表接口。浏览器脚本额外禁止写请求和外站请求，不输出个人正文或截图，只记录宽度、h1 数量和邮箱链接一致性。

```sh
backend/.venv/bin/python scripts/remediation/serve_readonly.py
# 另一终端：仅本地预览，不部署
python3 scripts/remediation/preview.py baseline-v1 --port 15177 --api-port 18003
node scripts/remediation/browser-readonly.cjs
```

只读检查仍不代表真实内容已审定或生产映射已验证。结束后应比较 DB/uploads 指纹；停止时核对 `.remediation-runtime/baseline-v1/readonly.pid` 及 `preview-15177.pid` 的进程身份后再终止。
