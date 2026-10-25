# 可重复隔离验收

默认验收从零生成测试内容，不读取真实 `.env`、DB、uploads，不使用 seed，也不复用 baseline-v1 或 frontend/dist。
**禁止对正常 127.0.0.1:5174 / :8002 做测试写入或进程清理。** 服务绑定端口 0 并保留 socket，实际端口写入本次运行的 ready 文件。

## 一个命令

```sh
python3 scripts/remediation/verify.py                 # 默认 core
python3 scripts/remediation/verify.py --profile full  # 完整矩阵 + contrast
```

本地已有 backend/.venv、Node 24、Playwright 1.58.2 和 Chrome 时无需额外安装。
解释器可指定 `--python /absolute/path/to/python` 或 `REMEDIATION_PYTHON`。
Playwright 从 scripts/remediation/tools、仓库/祖先 node_modules、frontend 解析；Chrome 使用
`PLAYWRIGHT_EXECUTABLE_PATH`，否则优先 `/usr/bin/google-chrome`，最后 Playwright Chromium。
full 的像素取样使用 `REMEDIATION_IMAGE_PYTHON`，默认运行 runner 的系统 Python（本地已有 Pillow），
独立于 backend venv；CI 显式使用安装了 Pillow 的 venv。缺少依赖直接失败，不以 skip 代替通过。

| Profile | 实际覆盖 |
| --- | --- |
| core（快速业务验收） | 两个 TS 配置检查、ESLint、外置 `/ha/` 生产构建及编译 CSS 契约；自动发现全部 backend `test_*.py`；auth/routing/content helper；真实 API/媒体 smoke；pass1 功能、reading、states、admin、settings-files、gate、avatar；公开站导航故障恢复/滚动焦点/打印/移动模态与后台窄屏/模态/删除锁/主题预览专项；12 个公开页面组合（六页×中英×亮色×390px）及公开交互 |
| full | core 业务，加公开 72 组合（六页×中英×亮暗×320/390/1440），替代 core 12 组合；三个预设亮暗主题的 30 项局部 contrast 取样；显式必跑 browser-a11y-performance.cjs 与 browser-security-concurrency.cjs。缺失脚本/不支持取样或未达阈值均失败，不宣称全站无障碍 |
| smoke | 仅合成 fixture、真实 API、端口 0 preview、HTTP/PNG/下载/404 生命周期自检；静态 HTML 是明确测试占位，不是生产构建，不运行完整套件 |

顺序执行，首次失败即停止；报告 `status` / `exit_code` 不会将后续未运行项目标记通过。
退出 0=所选范围完成，1=失败，124=超时，130=中断。默认单阶段 600s、全局命令预算2700s，可用
`--stage-timeout` / `--timeout` 调整。服务启动健康检查也有限时。

## 环境接口与扩展

runner 显式覆盖：
- `REMEDIATION_RUN`：本次新目录中的 fixture 绝对路径。
- `REMEDIATION_ORIGIN`：`http://127.0.0.1:<动态preview端口>`。
- `REMEDIATION_API_PORT`：独立 API 实际端口。
- `REMEDIATION_PYTHON`：后端/测试解释器。
- `REMEDIATION_IMAGE_PYTHON`：contrast 像素解码解释器，不要求 backend venv 安装本地已有的系统 Pillow。
- `PLAYWRIGHT_EXECUTABLE_PATH`：可选浏览器可执行路径。
- `REMEDIATION_BROWSER_TMP`：core/full 自动分配的项目内短目录，同时设置子进程 `TMPDIR/TMP/TEMP`；浏览器脚本无需另行配置或创建 profile。
- 内部 `REMEDIATION_FIXTURE_ROOT`：本次 backend 子测试 fixture 所属目录。
- `REMEDIATION_TEST_ROOT=<owned workspace>/tests`：所有 backend/security/deploy 子测试的统一父目录，只允许项目 `.remediation-runtime/` 内。子测试应创建独有子目录并校验 symlink/所有权，不清理兄弟目录；runner 最终只清理自己的 workspace。

新 browser 脚本复用 `browser-env.cjs` 的 `{ROOT,RUN,ORIGIN,BASE,PYTHON,EXECUTABLE,chromium,assertFixture,guard}`
或 `browser-states.cjs` 的 `harness()`。扩展需要显式登记：

共享 harness 的固定接口（并发/security/UI writer 可直接复用，不改工具）：

```js
const { harness, ROOT, RUN, ORIGIN, BASE } = require('./browser-states.cjs');
const h = await harness('browser-security-concurrency'); // 已验证fixture，真实API登录并启动Chrome
let failure;
try {
  const page = await h.context.newPage();
  await h.check('safe-stage-name', async () => {
    const pages = await h.api('GET', '/admin/pages');
    // h.api 使用 /ha/api、guard、测试token；204返回null，不自动重试。
    // 负例/并发可用 h.request，返回标准fetch Response：
    // await h.request('PUT', '/sections/123', payload, {expectedStatus: 400});
    // FormData: h.request('POST', '/upload', formData, {rawBody:true});
  });
} catch (error) { failure = error; }
finally { await h.finish(failure); }
```

- `ROOT/RUN/ORIGIN/BASE`：仓库、隔离fixture、动态origin、origin+'/ha'。
- `h.manifest/pages`：fixture ID/已加载页面；`h.secrets.ADMIN_USERNAME/ADMIN_PASSWORD` 只用于真实登录UI，禁止输出；`h.token` 仅供必须自定义请求的测试在内存使用。
- `h.context`：已经launch的Chrome context；`h.context.newPage()` / `waitForEvent('page')` 支持标签页；不需另开browser。
- `h.api(method, endpoint, json?)`：标准成功状态JSON API；`h.request(...,{expectedStatus?,rawBody?})`：安全guard相同，支持预期4xx、FormData与并发Promise，返回Response；endpoint以 `/sections` 等开头，不含 `/ha/api`。
- `h.remember(endpoint, originalFields)`：写前注册PUT恢复与runtime恢复日志；`h.deferCleanup('unique-label', async () => ...)`：注册删除新建测试记录等清理。新建意图/ID日志由调用方写入RUN，勿包含秘密。
- `h.guard(url)`：自定义请求须先调用；`h.wait(fn)`：有界轮询；`h.check(label, fn)`：固定安全阶段名及断言。
- `h.finish(error?)`：逆序执行清理、关闭所属browser、写安全结果及失败退出码；不会停共享API/preview，那两个服务只由runner清理。不要自行kill端口或删除父目录。
- 若确需独立browser，`browser-env.cjs` 导出 `{chromium,EXECUTABLE}`；调用方必须finally关闭自己的实例。

```sh
python3 scripts/remediation/verify.py --profile full \
  --browser-extra browser-a11y.cjs --browser-extra browser-perf.cjs
```

缺失扩展脚本会失败，不自动 skip。扩展文件须为 scripts/remediation/browser-*.cjs，不允许 readonly。
`browser-a11y-performance.cjs`、`browser-security-concurrency.cjs` 已在 full 默认显式清单中，无需重复参数；core 可用 `--browser-extra` 单独纳入。
full 另执行 `python -B -m unittest discover -s deploy/tests -v`，共享上述测试目录接口；core 不运行 deployment sandbox。
不得将密码/token传命令行、打印错误参数、启用 DEBUG/PWDEBUG、保存登录截图/trace/HAR。

content/routing helper 加载 frontend 实际安装版本的 DOMPurify UMD 浏览器包及真实浏览器 DOM。
routing 的 React SSR renderer 和 router 通过现有 Vite 内存打包（write:false/envDir:false），保留根路径及 /ha/ 的 SSR 路由断言；不 stub sanitizer 或绕过 URL 检查。

## 数据与生命周期边界

新 `.remediation-runtime/verify-<随机ID>/` 属于当前用户，目录700、进程umask077、秘密600。
显式设置 DATABASE_URL、UPLOAD_DIR、ADMIN_USERNAME/PASSWORD、JWT，cwd 为隔离目录；后端导入前预建 uploads。
Vite 使用独立配置 `envDir:false`，不读取 frontend/.env；build、cache、tsbuildinfo 都放本次 runtime，不覆盖 frontend/dist。
构建 cwd 保持为 frontend，使 Tailwind 按正常位置读取配置和内容源；隔离依靠 envDir/cache/outDir，而不是改变工具的配置发现语义。`check-built-css.cjs` 会拒绝缺少既有布局工具类的产物，不能仅凭 Vite 退出 0 放行。
runner 不继承生产配置变量、DEBUG 或 VITE_*。无部署密钥、无 sudo、无应用依赖变更。

成功/失败/timeout/SIGINT 的 finally 只终止自己以新 session 创建的进程组（包括其 Chrome 子进程），
不按端口杀进程。随后检查路径、所有权和 marker，删除本次 workspace（DB/uploads/secrets/rawlogs也删除）。
`--keep-runtime` 是显式本地排障选项：保留敏感合成 runtime，**不可打包上传**。强制 SIGKILL/机器掉电不能保证 finally，
遗留目录需人工核对 owner marker 和进程后处理，禁止盲目批量删除。

### Chrome 短 socket/profile 目录

core/full 为每次运行独占创建 `ROOT/.browser-tmp/<6hex>`（0700、独占mkdir碰撞重试），
`.browser-owner.json`（0600）绑定用户UID、本次workspace绝对路径/ID及短目录名；拒绝symlink和所有权不匹配。
采用6hex而非8hex是为了当前本地checkout的Unix socket长度预算：临时根为60 UTF-8字节，
预留47字节（Chromium已知SingletonSocket后缀46字节加1字节余量），总路径不超过107字节（108字节sun_path包含NUL）。
本地与CI都按实际UTF-8字节数检查；checkout太长时preflight明确提示缩短路径，绝不回退到项目外 `/tmp`。

core/full 的 `preflight` 使用 `browser-preflight.cjs` **实际launch并close Chrome**，不访问任何站点，
在TS/build及业务测试前发现环境问题。smoke仍无浏览器。
finally先结束本次自有进程组，再按绑定marker删除唯一持有的短目录；失败、timeout、SIGINT和
`--keep-runtime` 都会清理浏览器profile。若进程组清理失败，不冒险删除仍在使用的profile，报告失败。
不glob清理兄弟run，也不触碰历史keep-runtime目录；短目录永远不进入artifact。

## 报告与 CI artifact

结果只发布到 `.remediation-runtime/reports/verify-<ID>/report.json` 和明确白名单截图。
report 的 `results` 由字段白名单重建，**不整体复制任何子JSON**：harness只留源码静态stage/status/error类名；
公开矩阵只留locale/slug/theme/width/lang/rootFontSize/h1/overflow；contrast只留预设/模式/页面、固定测点名、测量数值和RGB颜色；
a11y/performance只留已知静态检查与计数、JS请求数/编码体积/传输体积、LCP/CLS、viewport及媒体数量。
任意URL、正文description、资源path、错误message、payload、secrets及恢复记录均不发布；NaN/Infinity指标被丢弃。
helper日志只提取固定成功行中的数字计数，原始日志不复制。缺失子结果不伪造通过。
CI 只上传该 reports 子目录，绝不上传整个 runtime、原始日志、DB、秘密、恢复日志、登录响应、trace/HAR。
截图白名单限定当前合成站点公开矩阵和指定后台非登录区域；扩展截图不会自动进入 artifact。
`.github/workflows/verification.yml` 使用同一 full runner，固定 Node24.22.0、Python3.12.13、Playwright1.58.2，
测试工具单独安装在 scripts/remediation/tools，不修改 frontend package/lock。远端 CI 需 push/PR 后才能验证，本轮不 push。
checkout 设置 `persist-credentials:false`，不把GitHub checkout凭据留给测试子进程。

## 工具自身验证

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/remediation/tests -v
python3 scripts/remediation/verify.py --profile smoke
```

unit 覆盖所有权/symlink拒删、环境过滤、进程组范围、失败返回、timeout与SIGINT清理。
另覆盖artifact字段白名单保留安全数值而排除秘密/原始日志/restore，以及nan/inf超时参数在创建workspace前拒绝。
不要为测试 runner 反复启动全套浏览器；整合时由主会话跑一次 full。

## 明确不在默认验收中

真实数据 readonly 验收、历史 baseline 截图对比、真实内容审定、正式简历、线上部署均排除。
旧手工脚本保留 baseline-v1/15174 fallback，仅在未使用 runner 时适用；readonly 还必须显式
`REMEDIATION_ALLOW_READONLY=1` 且不能携带 `REMEDIATION_RUN`。无任何默认路径打开真实库。

## 本轮工具验证记录（2026-10-24）

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/remediation/tests -v`：最终退出0，7项通过。
  初次SIGINT测试发现默认参数绑定导致测试注入目录无效，已修正并清理仅属于该单测的两个空遗留目录。
  单测内部刻意制造的退出1/124/130是断言对象，不是验收被忽略的失败。
- 隔离 wrapper 下 `backend/.venv/bin/python -m unittest discover -s backend/tests -p test_remediation.py -v`：退出0，5项通过；动态端口，临时fixture已清理，未改业务断言。
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/remediation/verify.py --profile smoke`：退出0，fixture与HTTP smoke通过，进程/运行数据清理通过；报告在 reports/verify-a39dcfb4de214619be51ecedb2b9121b/。
- 所有 remediation `.cjs` 的 `node --check`：退出0。
- 安全依赖适配后 `node scripts/remediation/content-test.cjs`：退出0，9项；`node scripts/remediation/routing-test.cjs`：最终退出0，92项。routing 初次加载器运行失败（浏览器库构建保留了 process.env），已显式定义测试构建环境并修正，不改应用安全实现。
- 依赖探测：现有Playwright1.58.2与Chrome可用；backend venv没有Pillow（探测退出1），系统python3有Pillow（退出0），故默认使用独立系统图像解释器，不要求用户重复安装。
- 工具 lane 在此阶段未运行 core/full 整套或远端 CI；后续主会话整合结果见下方。本轮无 push、无部署。
- 有界收尾后 supervisor unit 再跑：9项通过，退出0；未运行full。新增artifact/非有限超时参数单测均通过。
- Chrome短路径边界修正后：supervisor unit **14项通过，退出0**，保留主补的backend spawn-import测试；新增隔离/owner/symlink/UTF-8长度、失败/超时及keep-runtime下SIGINT短目录清理检查。
- 独立真实 `browser-preflight.cjs` launch/close：退出0，TMPDIR=60 UTF-8字节，socket预留47字节；自有profile及验证workspace已清理。没有重跑full，没有访问正常5174/8002，也没有清理任何旧run。

### 最终主验收

- `python3 scripts/remediation/verify.py --profile full` 默认自动清理模式退出 **0**，25 阶段全部通过；后端45项零跳过、部署沙箱32项、helper126/92/9项、公开72组合及所有业务/安全/无障碍浏览器阶段通过。
- 报告：`.remediation-runtime/reports/verify-03a6e5e65ee64980a66992a5a2b98e2f/report.json`。进程、主运行目录和浏览器短目录三项 cleanup 均 passed。
- 整合期间已修复 backend 测试 spawn 重入、Chrome 长 socket 路径、Tailwind cwd 配置发现问题；非法 OG 写入测试已调整为验证新 API 的400拒绝及旧数据展示容错，而不是放宽业务断言。
- 随后仅增加长说明键盘 End 触底断言并定向通过，无应用变更。范围、性能实测值及剩余限制见根目录 `HARDENING_REPORT.md`；远端 GitHub Actions 仍未触发。

### 首次远端运行后的兼容性修正

- GitHub run `40044355161` 在 `npm ci` 阶段失败：锁文件缺少跨平台可选依赖。提交 `8627683` 仅新增29个缺失记录，没有更改已有包条目或版本；干净目录中的安装、lint、TypeScript和生产构建通过。
- run `40046699498` 的安装、监督器检查、构建和后端测试通过，但部署沙箱退出1。其原artifact只有阶段退出码，不能据此直接断定具体失败用例。
- 使用独立 Python 3.12.13，并让 shell/shebang 与测试使用同一解释器后，确证 `deploy/operator.py` 遮蔽标准库同名模块，导致 CLI 启动循环导入。两个可执行入口现排除自身脚本目录；不改变部署权限或服务协议。新增启动与安全诊断回归，Python 3.12及3.10的34项沙箱检查通过。
- 部署测试改由 `deploy_suite.py` 收集计数、固定测试ID和受限错误类型；完整入口在失败时也保留该摘要，不公开原始 traceback、断言正文、subtest参数或秘密。
- 本地整合报告 `reports/verify-58f9c17591064892b902fcdbaed20223/report.json` 已确认部署34项通过，但后续 `hidden-page-no-stale-content` 浏览器断言失败。定向复现发现旧断言以 URL 更新作为 React 提交边界，混淆了提交前仍显示的公开旧内容；原失败现场已清理，不能追认其具体帧。测试现使用真实 Header Link，先加载菜单再于隔离 API 隐藏目标，延迟真实响应并检查 React 提交后无旧区块、隐藏内容始终不存在、匿名 API 与直接访问404。两次定向运行通过，未修改应用代码或跳过断言。**此记录不代表新一轮远端 CI 已通过。**
- 公开页交互测试另补有时限的 `html.lang`/菜单展开状态等待和图片解码等待；不再把 URL 先更新当成 React DOM 已同步。矩阵成功检查改为固定名称，以便安全报告白名单保留。
- 修正后的完整入口最终退出 **0**，所有阶段通过，部署34项零失败/错误/跳过；本地证据：`.remediation-runtime/reports/verify-9958b4d2fba244b2bc13b4f13bddd50d/report.json`，日志 `.remediation-runtime/ci-40046699498/full-integration-stable.log`。推送后 GitHub Actions run `40049135234`（`a7dc128`）、`40077593072`（`10aadba`）与 `40210180019`（`bffd709`，评审后修正）均通过。评审后修正的验收记录见 `HARDENING_REPORT.md` 末节。
