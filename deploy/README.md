# 可审查的本地发布工具（不是首次安装器）

`bash deploy/deploy.sh` **只读 plan**，不加载 nvm、不 source `.env`、不 mkdir、不安装/构建、不导入应用。缺 `.env` / 真实 DB 时说明缺口并 exit 1；绝不 seed。只读检查只读 SQLite 文件头，避免 SQLite WAL 的只读连接也可能创建 SHM。完整 integrity_check 在停写后的 backup API 副本上执行。

当前改动只经过 sandbox 验证，**没有上线、没有真实 stop/start、没有 Nginx 核验结论**。正常开发服务不属于此工具的目标。以下 apply 命令仅供取得另行发布授权后的 operator 使用。

## 支持边界

- Linux / Python 3.10+ 标准库；已存在的 backend/app、requirements.txt、venv、frontend/dist，以及真实 SQLite 和 uploads。不是首次部署，不创建系统服务，不修改系统文件，不调用 sudo。
- `.env` 为严格 `KEY=value`，允许整值单/双引号；拒绝重复、插值、shell 语法、转义、行尾注释等歧义。敏感值不输出。凭据必须非空非默认。显式 `DATABASE_URL=sqlite:///./data/真实库.db`（或 repo/backend/data 内绝对路径）、`UPLOAD_DIR=uploads`（或同目录绝对路径）。SQLite query/URI/memory、其他数据库、任意外置数据目录不支持。
- 本项目 Nginx uploads alias 固定 backend/uploads；自定义上传目录直接拒绝。路径、数据树、代码树不允许符号链接；只有 venv 内链接按原样备份，不遍历。SQLite sidecar 也检查路径。
- 发布对象仅 backend/app、backend/requirements.txt、backend/venv、frontend/dist。前端源文件、deploy、`.env`、真实数据不随代码发布替换。不要先 git pull 覆盖 live 后端，否则备份到的不是旧代码。保留当前运行目录，将新版本准备为独立 candidate。
- 不提供 schema migration、不自动回滚数据、不删除历史备份。需要 schema 变更时另行审查。不支持同时执行多个发布；同一 `.env` 上持有非阻塞 flock。发布期间不得修改 `.env`、候选代码、adapter、服务配置、Nginx 或自行启动其他 writer。
- 这是部署隔离目录，不是安全容器：candidate/npm/pip/adapter 必须是受信任、已审核的代码；安装脚本本身能够访问 operator 权限范围。备份 manifest 检测意外损坏，不是对恶意篡改的数字签名。

## 运维前置核验（必须先准备好服务/Nginx）

参考 `ha-portals.service` / `nginx.conf`，由系统管理员另行准备。不由本工具安装、enable、reload 或修补 include。operator 必须能无 sudo 读取有效配置并操作已存在的 `ha-portals.service`，否则拒绝。

可直接使用仓库中已设置 executable mode 的 `deploy/operator.py`。在本项目 `deploy/prepared.json` 填写以下人工审核证据（不要提交该文件或配置输出）：

```json
{
  "root": "/绝对路径/HA-PORTALS",
  "nginx_sha256": "有效 nginx -T stdout UTF-8 的 SHA256",
  "service_sha256": "下列 systemctl show stdout UTF-8 的 SHA256",
  "env_sha256": "backend/.env 原始字节 SHA256",
  "reviewed_environment_file_only": true,
  "reviewed_exclusive_writer": true,
  "reviewed_effective_locations": true,
  "public_health_url": "https://实际域名/ha/api/health"
}
```

服务配置取证命令（输出含敏感配置，不发到公共日志）：

```sh
systemctl show ha-portals.service --property=FragmentPath,DropInPaths,User,WorkingDirectory,ExecStart,Environment,EnvironmentFiles
nginx -T
```

人工审核要求：服务确实使用 repo/backend 工作目录、原路径 venv/bin/uvicorn 和唯一 backend/.env；Environment/manager environment/drop-in 不得覆盖应用配置（PATH 除外）。核验 systemctl show 的已加载配置与磁盘一致，没有待 daemon-reload 的变更。核验实际 server include、location 优先级、dist/uploads alias、API 8002 反代及 public_health_url。确保该服务是唯一 DB/uploads writer，没有 dev uvicorn、任务、容器、socket activation 或外部进程继续写入。**停止一个服务不等于自动证明全局停写**：exclusive_writer 是运维必须真实核实的前提，而不是脚本发现保证。

adapter 核对完整有效配置哈希与 `.env` 哈希；没有证据或发生配置漂移就失败，不能因仓库 snippet 存在而宣告 include 生效。有效配置中所有 server/location 的语义不能靠简单字符串自动证明，必须人工审查后固定上述证据。`operator.py` 同时检查直连和真实 Nginx API 健康入口。

自定义 adapter 的协议：可执行文件位于 repo 内，调用 `adapter ACTION ABSOLUTE_ROOT`，非零即失败，stdout 只能为 JSON，不打印凭据；`verify` 返回五个严格 true 字段：service_config/nginx_include/aliases/environment/exclusive_writer；`stop` 必须执行停写并返回 `{"stopped":true}`；随后独立 `stopped` 再确认；`start` 返回 `{"started":true}`；`health` 返回实际 HTTP status 和解析后的 JSON：`{"http_status":200,"body":{"status":"ok","db":"ok"}}`。禁止在真实环境使用测试 stub。adapter 临时进程组中不得留下后台 writer，也不得自行 daemonize/脱离本组；每次调用结束（包括成功）都会清理该组残留成员。默认 operator 通过 systemctl 管理**预先存在的 systemd 服务**，服务由 systemd 启动，和 adapter 临时进程组不同；工具不会按端口或进程名杀其他服务。

## 发布和恢复流程

1. 另行授权，关闭外部写入口，检查磁盘空间（至少旧 venv + dist + 代码 + DB/uploads 两份）、配置证据、独占 writer。保留旧 live 代码。将审核候选（backend/app、requirements.txt、frontend 完整源码/lockfile，无 node_modules、dist、链接）放入 repo 内独立目录，例如 `.remediation-runtime/candidate`。预先在 shell 中设置好 Node/npm PATH；脚本不 source nvm。
2. 先 plan；然后显式 apply：

```sh
bash deploy/deploy.sh
bash deploy/deploy.sh --apply --adapter "$PWD/deploy/operator.py" \
  --source "$PWD/.remediation-runtime/candidate"
```

3. 工具先验证配置，再在 `.remediation-runtime/releases/<id>/staging` 内 npm ci/build。当前 dist 和 venv 不动。然后 stop + stopped，SQLite backup API + uploads **实际复制**，SHA256 manifest 和 SQLite 完整性验证；这是**依赖全局停写前提的一致时点备份**，不是两个在线副本的“原子快照”。接着复制旧 code/dist/venv，再安装候选代码和依赖、替换 dist、start、HTTP + JSON health。HTTP 200 但 db/status degraded 仍失败。
4. venv 仅复制备份，安装和恢复均在原绝对路径；不移动虚拟环境后再运行它，避免 shebang 失效。每次操作保存 identity、code/data manifest；成功后有 completed 标记。备份目录仅 owner 可访问，含依赖和数据，不提交。
   npm/pip 与 adapter 使用同一个受管命令 primitive。每个 npm/pip 命令默认最多 900 秒，可通过 operator 环境变量 `HA_RELEASE_COMMAND_TIMEOUT` 设置秒数（必须有限且 `0 < 秒数 <= 86400`，apply 前校验）；adapter 每次调用的上限为该值与 120 秒的较小值。每条命令通过 start_new_session 创建独立进程组；无论成功、非零退出、超时还是异常，返回/抛出前都 SIGKILL 清理本组残留成员并 wait 回收直接子进程，随后才允许 rollback。受信任的构建/安装脚本不得自行 daemonize/脱离进程组。
   supervisor 在执行阶段收到 SIGINT/SIGTERM 时转为 Cancellation 异常并非零退出，不打印成功或写 completed；命令组清理与失败恢复期间忽略后续 SIGINT/SIGTERM，最后恢复原 handlers。健康通过后的最终成功提交临界区也忽略取消，避免 completed 已提交却被报告为取消。无法恢复健康时再次尝试停服，明确报告已停服或 STOP UNCONFIRMED 与快照路径，保持外部流量关闭。SIGKILL/断电仍无法提供自动恢复保证。
5. 失败 exit 非零，不打印成功。变更后失败会再次 stop，恢复 code/dist/venv，再 start + health；仍不会恢复 DB。恢复失败明确报告，保持外部流量关闭并人工处理。stop/确认失败不会复制数据或发布；服务状态可能不确定，须人工检查。断电/SIGKILL 不保证自动恢复，使用留存快照人工处理；不要把该工具当高可用零停机发布器。

代码回滚（保留后续 DB/uploads；回滚前也保存当前状态）：

```sh
bash deploy/deploy.sh --apply --adapter "$PWD/deploy/operator.py" \
  --rollback "$PWD/.remediation-runtime/releases/需要恢复的旧快照ID"
```

只有确认数据损坏/兼容性问题并明确接受丢弃后续写入，才能恢复同一快照数据：

```sh
bash deploy/deploy.sh --apply --adapter "$PWD/deploy/operator.py" \
  --rollback "$PWD/.remediation-runtime/releases/旧快照ID" \
  --restore-data --confirm-data-loss RESTORE-DATA-LOSE-LATER-WRITES
```

数据恢复同样先 stop/确认，并将**当前** DB/uploads 保存至新快照；旧快照必须通过 manifest 和路径 identity 检查。若恢复中途失败导致部分数据替换，保持服务停止，报告新快照位置，不能擅自启动混合状态或自动丢弃数据。操作者需核验两套快照并单独决定后续恢复。HTTP 健康不是完整内容验收：发布后还需人工核对公开静态资源字节、上传文件、CMS关键页面。

## 沙箱验证

```sh
python3 -B -m unittest discover -s deploy/tests -v
```

每次运行在 `REMEDIATION_TEST_ROOT` 下创建新的 `deploy-tests-*`；未设置时默认 `.remediation-runtime`。路径必须解析在本项目 `.remediation-runtime` 内且不经过 symlink，检查通过才创建目录。测试不删除其他 run；主 runner 可自行清理其传入目录。全部 fixture、SQLite、uploads、日志和备份均写入该新 sandbox。adapter 为真实子进程 stub，构建/安装用 mock，另有完整 CLI 经命令 stub 跑通；绝不运行真实 systemctl/nginx/npm/pip，不触碰 5174/8002。覆盖只读零写、无 env/DB 拒绝、路径防逃逸、备份/manifest、停写阶段门槛、构建/安装/启动/健康失败、200 degraded、代码回滚保留数据、显式数据恢复及新状态备份、部分恢复保持停止。真实子进程测试覆盖安装/adapter 的 SIGINT、SIGTERM、超时，以及父进程非零/成功退出后仍有 child；验证整组清理、第二次信号不打断恢复、handlers 还原、失败无 completed/success、回滚后无延迟 venv 写入。真实 operator 权限、配置语义、网络和生产构建仍须授权后上线前核验。
