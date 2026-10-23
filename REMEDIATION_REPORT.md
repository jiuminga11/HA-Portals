# 整改实施与验收记录

执行日期：2026-10-23 至 2026-10-24。三批可独立实施的代码整改已完成并本地验收；内容/资产阻塞项见末尾，不能据此宣称所有交接项全部完成。

## 范围与数据安全

- 基线：`dev` / `4b7f841`；开始时工作区干净。执行依据为根目录 `REMEDIATION_HANDOFF.md`，不依赖 `.omo/` 或 `docs/`。
- 初始三批执行阶段未提交、未推送、未部署，真实 DB/uploads 未改，也未运行 seed。后续用户授权的本地提交与三处 CMS 文案修正，见下方补充记录；仍不推送、不部署。
- 收尾已关闭本轮本地隔离/只读预览服务；运行环境和证据保留，重启方式见 `scripts/remediation/README.md`。
- 运行数据只读核对：6 个可见页面、14 个区块、13 个区块中英文标题不同；上传目录无 PDF。数量不代表公开内容审核通过。
- 运行数据文件的 SHA256 基线保存在被忽略的 `.remediation-runtime/protected-files-before.json`。测试数据、截图、日志均不进入 Git。
- 所有写入测试使用从零生成的合成数据；测试 PDF 如有，仅用于文件传输验证，绝不作为正式简历。

## 基线验证

| 检查 | 结果 | 本地证据 |
| --- | --- | --- |
| `cd frontend && npm run build` | 退出码 0 | `.remediation-runtime/baseline-build.log` |
| `cd frontend && npm run lint` | 退出码 1，3 个既有错误 | `.remediation-runtime/baseline-lint.log` |

三个 lint 错误为 Header 的 effect 内同步 setState，以及 useLocale/useTheme 的非组件导出。基线生产产物留存于 `.remediation-runtime/baseline-dist/`，用于同一合成数据上的前后比较。

## 第一批

已实施：中英文标题独立编辑/保存；新建区块显式归属、无效页面/不存在区块禁止提交；同页排序 UI 更新、请求锁和失败回滚；服务端完整同页排序校验及创建/删除/重排单事务；富文本长链接断行；三项既有 lint 修复。

已运行验证：
- `npm run lint`、`npx tsc --noEmit -p tsconfig.app.json`、`npm run build`：均退出 0，日志 `.remediation-runtime/pass1-{lint,tsc,build}.log`。
- `backend/.venv/bin/python -m unittest discover -s backend/tests -v`：11 项通过，退出 0；日志 `.remediation-runtime/pass1-backend.log`。
- `node scripts/remediation/browser-pass1.cjs`：Chrome 真实浏览器、生产 `/ha/`，退出 0。验证不同中英文标题原样保存/单改/刷新、新建到非 1 页面、缺失页面/区块禁保存、连续上下移及刷新持久化、503 排序失败回滚；结果 `.remediation-runtime/baseline-v1/pass1-browser.json`。
- 六个中文页面 × 320/390/1440px × 亮/暗主题，共 36 张页面截图，外加后台及基线截图；根字号 20px。截图位于 `.remediation-runtime/baseline-v1/screenshots/pass1/`，旧硬编码页脚已遮挡。展示动画在截图前显式展开，这些截图不验证动效触发。
- CV 长邮箱在上述视口无整页横向滚动，mailto 与完整文本选择保持。**合成基线未复现交接中真实 CV 的 437px 溢出，不能把合成截图称为原数据问题的前后复现。**未模拟操作系统邮件客户端或系统剪贴板。

后续补充真实内容只读验收：`scripts/remediation/serve_readonly.py` 强制 SQLite `mode=ro`、`lifespan=off`、GET/HEAD-only 且屏蔽管理/认证接口；浏览器也拦截所有写请求与外站请求。未输出个人正文、邮箱或截图。对同一现有数据库比较基线产物与第二批产物，20px 根字号：CV 在 320/390px 的基线整页宽度均为 **437px**；整改后分别为 **320px / 390px**，不再整页横滚。证据 `.remediation-runtime/readonly-cv-before-after.json`。现有六页 × 中英 × 亮暗 × 三视口的 72 个稳定态组合检查全部通过（无横向溢出、每页一个 h1、邮箱显示文本与 mailto 一致），证据 `.remediation-runtime/readonly-browser.json`。此项现在补足了原 CV 问题的真实数据前后尺寸复现，而非仅合成样例验证。

只读复测后，现有 DB/uploads 共 11 个文件 SHA256 与开始时完全一致；证据 `.remediation-runtime/protected-files-check.json`。

稳定态复核：首轮截图/尺寸采样发生在 reveal 过渡中，曾观察到 About 临态横向尺寸偏大；调整为同时展开 reveal/reveal-x、结束动画后再截图和测量，36 个稳定态页面均无整页横向溢出（`.remediation-runtime/baseline-v1/pass1-visual.json`）。这不是已确认的时间线缺陷；项目表完整内容需要局部横滑的阅读问题仍存在，留第二批。视觉复核已确认邮箱完整、双语编辑字段层次清楚，不以截图证明交互。

待后续：英文路由矩阵留第二批。正式 PDF 不存在、公开文案未获审定，因此“简历下载承诺与实际入口”尚未完成，未生成假简历或改真实 CMS。

一次服务重启中断浏览器首跑，已恢复原隔离环境并完成浏览器重跑；未重建或覆盖真实数据。

## 第二批

已实施语言兼容方案：以 URL 决定界面语言，增加 `/en/` 与 `/en/:slug`，保留原中文路径；切换保留当前页面、query、hash，html lang 同步。五类单语区块就近提示原文，未伪造英文正文，不改继承 content schema、不迁移数据库。只读检查当前没有 `en` slug 冲突，新建/改名保留该 slug。

展示整改：手机表格改为完整字段条目，桌面保留可聚焦横滑区、提示及列对齐/宽度；移除关键文字截断；手机首页先呈现身份/现有研究问题/CTA，再呈现装饰标识；研究页提供可见区块导航，非首页补 h1，去除匹配的重复首标题；改善标题/说明/链接阅读色；统一内容页链接与媒体 `/ha/` 处理，保留头像焦点。

验证：
- `npm run lint`、`npx tsc --noEmit -p tsconfig.app.json`、`npm run build`、后端 11 项测试均退出 0；证据 `.remediation-runtime/pass2-*.log`。
- `node scripts/remediation/routing-test.cjs`：62 项路径 helper 检查通过。
- `node scripts/remediation/browser-public.cjs pass2`：72 个稳定页面组合（六页 × 中英文 × 亮暗 × 320/390/1440，20px 根字号）通过无整页溢出/单 h1/可见性检查。语言深链刷新、切换保留位置、触屏菜单、键盘 Enter/Escape、真实头像解码及焦点、文件链接、404 路由均通过。证据 `.remediation-runtime/baseline-v1/pass2-browser.json`、`screenshots/pass2/`。
- `node scripts/remediation/browser-reading.cjs`：手机每个表格字段与 API 原文逐项相等，无省略号；研究导航目标存在；桌面表格键盘可聚焦；首页身份位于装饰之前；图库 Enter 打开、Escape 关闭。证据 `.remediation-runtime/reading-browser.json`。
- `node scripts/remediation/contrast.cjs`：三主题 × 亮暗，共 30 个指定测点（研究标题/正文/指标值/指标说明，CV 链接），实际 Chromium 背景像素采样，最低 4.81:1；结果 `.remediation-runtime/contrast.json` 记录前景/背景、CMS 覆盖及采样限制。不是全站 WCAG 达标声明，未覆盖所有内容或交互状态。
- 测试首跑的文件链接等待时序、图库原生 dialog 选择器已修正；仅重跑对应交互检查，保留有效的 72 页矩阵证据。
- 代码门禁发现标题去重可能误删标题内锚点/链接，已限制为无属性且无子元素的纯文本重复标题，空白仅折叠、不拼接单词。`node scripts/remediation/content-test.cjs` 在 Chrome DOMParser 上执行实际模块，9 项内容保全检查通过；代码复核通过。
- 已补双语区块缺失英文配对字段的原文提示（包含指标说明）；针对性生产构建和阅读交互回归通过，未重复未受影响的后端测试。

未完成内容项：两个旗舰案例的审定材料/截图、研究开篇事实和指标边界/论文状态、英文内容翻译、首页获批精选内容。没有擅自补写、发布或打开隐藏区块。

未来获批译文应使用 content 外层或独立映射，以区块 ID、语言、源版本绑定；每份译文保持原类型完整合法结构并通过原安全校验。缺失/过时则整块回退，且继承原页面及区块的可见性。此次不建设翻译平台或发布草稿模型。

## 第三批

代码实施与整批本地验收完成；第三批代码门禁的两处补充问题亦已修复并定向复测。

后端：按 slug 保护 home 隐藏/删除/改名，并拒绝创建或通过其他隐藏页面改名得到隐藏 home；不自动修复或公开既有隐藏首页。页面创建/删除/排序在同一事务归一化。上传引用扫描包含 `seo_og_image`；修复配置支持 PDF 而上传路由拒绝 PDF 的不一致，增加 MIME/扩展名配对和 PDF 基本文件头检查。

前端：
- 站点名称、首页副标题、logo、banner、页脚配置有明确消费者；首页配置介绍位于首个 Hero 之后。页脚不再从翻译字典输出个人信息。
- 页面标题/描述及站点 SEO 回退、OG 元数据随切页更新；错误页清除旧元数据并 noindex。异常/非 HTTP(S) OG 图片值被忽略，不影响正文。SEO 是客户端 DOM 更新，不是服务端预渲染。
- 404 与网络错误区分；返回入口、重试、加载、空态及 15 秒请求取消；不闪出前一页区块。
- 编辑器、站点设置和页面编辑有未保存保护；保存失败保留输入，保存中到达的新输入不被旧响应覆盖。主题只在局部预览，明确保存才写入；加载失败禁止把默认值存回。新页面仍保留原默认公开语义，不偷偷改为草稿。
- 401 不硬跳丢稿；当前标签保留表单，通过新标签登录恢复，用户手动再保存，绝不自动重放写请求。原生页面编辑 dialog 内也有可操作恢复入口。取消退出不会清除 token；进入即过期会转登录。登录请求实际超时取消并隔离迟到结果，旧 401 不清除新 token。
- **恢复边界**：输入仅保存在当前挂载页面内，不自动写入持久化草稿；刷新、关闭或放弃离开后不承诺恢复。

第三批验证证据：

| 检查 | 结果 / 证据 |
| --- | --- |
| 前端 TypeScript / 生产 build / ESLint | 通过；`pass3-tsc.log`、`pass3-gate-build.log`、`final-lint.log`；最后两处门禁修改的 focused ESLint/TS 亦通过 |
| 完整后端测试 | 18 项通过，`.remediation-runtime/pass3-backend.log` |
| 路由 / 认证状态 / 内容保全检查 | 90 / 126 / 9 项通过，`pass3-routing.log`、`pass3-auth-unit.log`、`pass3-content.log` |
| 原第一批核心交互回归 | 标题/归属/排序及失败回滚通过，`baseline-v1/pass3-core-browser.json` |
| SEO / 配置 / 错误状态 | 真实 API 配置保存、六页双语切页 SEO、描述回退、404/503/重试、慢网、空态、离线恢复、隐藏页无旧内容闪现；`baseline-v1/browser-states.json` |
| 编辑与认证恢复 | dirty 取消/侧栏/后退/刷新/退出、503 保稿、真实 401、跨标签重登、无自动保存、手动保存持久化、过期准入、10 秒登录取消及迟到隔离；`baseline-v1/browser-admin.json` |
| 后台设置、页面和文件 | UI 保存持久化/失败保留、预览不写库、不污染根样式、加载失败保护、home 禁用、模态框取消/Escape、新页默认公开、测试 PDF 上传/下载字节一致、剪贴板成功/失败反馈；`baseline-v1/browser-settings-files.json` |
| 最终门禁补测 | 异常 OG 配置不崩溃、合法本地/HTTPS OG 保留、原生 dialog 内真实 401 恢复并手动保存；`baseline-v1/browser-gate.json` |
| 头像裁切焦点保全 | 真实指针拖动 → 保存 → 刷新 → 前台焦点一致；重置居中可用；`baseline-v1/browser-avatar.json` |
| 邮箱实际复制 | 换行邮箱经 Ctrl+C 与浏览器真实剪贴板读回逐字符一致，mailto 不变；`.remediation-runtime/reading-browser.json` |
| 最终公开页面 | 72 个合成矩阵及深链/触屏/键盘/媒体通过；`baseline-v1/pass3-browser.json`、`screenshots/pass3/`；现有内容只读 72 组合也通过，`readonly-browser.json` |

上述日志文件名未写目录时均位于 `.remediation-runtime/`。后台截图位于 `baseline-v1/screenshots/pass3-admin/`。测试脚本的首轮 label 精确匹配选择器已修正，未通过修改业务行为迁就测试。代码门禁和指定截图视觉复核通过；不将截图当成交互证据。

PDF 上传测试使用显著标记 `TEST ONLY - NOT A CV` 的测试文件，仅位于隔离上传目录；这不是正式简历，也不表示 PDF 已经过完整解析或恶意内容扫描。

## 待审内容与材料（不阻塞独立代码工作）

- 站主已确认暂时没有正式 PDF，并批准“查看简历”及在线简历说明；正式中英文 PDF、语言和更新时间留后续提供。
- Apollo / psyacademic.chat 的个人贡献、交付物、验证链接、可公开截图及效果表述。
- 英文翻译、研究阶段、论文状态、毕业状态与日期、指标对象/范围/边界。
- 首页精选内容与完整经历的公开范围；现有隐藏内容保持隐藏。

## 结论边界

本地构建、合成数据回归和本地 `/ha/` 浏览器检查均不代表生产环境验收。真实简历下载、内容真实性和未获批准的文案修改不得标记完成。

### 已验证修复

双语标题/归属/排序、真实 CV 手机溢出、中英路由和原文回退提示、完整表格阅读/首页优先级、主题指定测点、配置消费者和 DOM SEO、错误恢复、home/上传引用保护、未保存提醒和认证恢复。五类继承 schema、头像编辑器及部署文件未修改；头像拖动焦点另外完成真实浏览器回归。

### 待确认内容

正式简历文件、获批英文翻译、两个旗舰案例的职责/成果/截图权限、研究阶段/论文状态/日期/指标范围、完整经历及精选内容的公开范围。站主确认这些材料后续提供；当前在线简历措辞已批准并落地。

### 未完成项

- 正式简历 PDF 下载交付仍待真实文件；不存在的下载承诺已按用户批准改为在线查看，网站明确暂不提供 PDF。
- 旗舰案例、研究概述/指标注释、英文正文、首页精选及完整经历内容更新：未获审定材料，未修改这些内容。
- 可选预览/发布草稿模型未实施。用户已授权仅本地 `dev` 提交；推送、部署仍需分别确认。

### 未验证风险

- 线上 Nginx `/ha/`、外部缓存、真实域名及社交平台 SEO 抓取；本地生产产物预览不等于线上验收。
- 多管理员并发编辑/排序、写入成功但响应丢失等竞争与故障组合未做压力验证；当前不是版本化合并/冲突解决系统。
- 全站无障碍、屏幕阅读器、全部自定义品牌颜色/交互状态、全部真实视频播放未完整覆盖；30 个测点不外推为全站达标。
- 页面/区块隐藏不等于上传附件访问控制；已知附件 URL 的访问权限仍沿用原设计。
- 真实正式 PDF 的内容与可公开性未验证；PDF 上传只有基本格式检查，不含完整解析/恶意内容扫描。

## 后续授权：审阅提交与简历措辞（2026-10-24）

用户授权审阅后提交 `dev`，明确暂缺正式 PDF 与其他内容材料；再次明确批准在已备份的当前 CMS 中只修改以下三处措辞。已提醒：若该数据库被线上使用，内容修改可能立即生效，与代码部署是不同动作。

1. 首页 Hero 按钮：`查看简历 / View CV`，仍链接 `/cv`。
2. CV 正文：`本页提供在线简历，暂不提供 PDF 下载。`
3. CV 联系信息说明：`本页仅展示公开联系信息。`

执行与证据：
- 改字前一致性备份：`.remediation-runtime/backups/pre-commit-20261023T165203Z/`（目录名为 UTC 时间）。SQLite backup API 从只读源生成快照，`integrity_check=ok`，逻辑内容哈希一致；7 个上传目录文件逐个哈希核对。备份仅保存在忽略目录，权限受限，不进入 Git。
- 先 dry-run 校验精确旧值，再在隔离副本演练，最后以单事务更新当前 DB 的 2 个区块（Hero 与 CV）的 content/updated_at。标题、其他记录、可见性、排序及上传文件保持原样；没有 seed 或 schema 迁移。
- 结果 `.remediation-runtime/approved-cv-copy-result.json`；浏览器以只读接口检查中英 × 320/390/1440px 的首页/CV，共 12 项通过，旧承诺不再显示，新措辞和链接正确，CV 无整页溢出。未导出个人正文或截图。
- 前端未使用的下载文案键改为 `viewCV`，避免再次引入误导承诺。提交前 `npm run lint`、`npm run build`、18 项后端测试、90 项路由、126 项认证状态、9 项内容保全检查通过；证据 `.remediation-runtime/precommit-*.log`。
- **代码提交不包含运行数据库、上传文件或备份**。其他环境不会因拉取 Git 自动获得上述 CMS 修改，需在获授权时单独同步内容。

### 部署前静态检查与回滚计划（未执行部署）

- `deploy/nginx.conf` 与前端约定一致：`/ha/` → `frontend/dist/`，`/ha/api/` → 8002 `/api/`，`/ha/uploads/` → `backend/uploads/`。这只证明仓库配置一致；有效 server include、location 优先级、实际 DB/上传目录与缓存未核实。
- 本机回环 `/ha/`、`/ha/api/health`、8002 健康入口均不可访问，因此没有线上通过结论。部署会将仓库 dist 作为静态目录；未来部署前构建宜先输出隔离目录，核准后再切换产物。
- 现有 `deploy.sh` 只对默认路径 DB 做普通复制、不备 uploads，也不随自定义 `DATABASE_URL` 调整；缺 DB 时可能复制 seed。不能把脚本自带备份当作一致性恢复保障，缺真实数据时不得直接执行初始化分支。
- 脚本对 Nginx include 缺失及健康失败只警告，HTTP 200 也不能证明健康 JSON 的 `status/db` 正常；未提供自动回滚。上线前需额外确认凭据、有效 Nginx 配置、健康 JSON 与资源字节。
- 获部署授权后：重新制作当时的 DB/uploads 一致性快照，并保存旧代码、dist、依赖及有效服务配置。回滚优先恢复旧代码/产物而保留当前数据；只有确认数据损坏或兼容问题时，才停写并恢复同一时点 DB/uploads，明确期间新增数据损失。此次修改不需要数据库结构迁移。
