---
title: fast-deploy 脚本入口（构建 / 部署）
slug: fast-deploy-scripts
status: delivered
domain: deploy
when: 构建前端 dist、本机起停、生产更新、H5、compose 专业包、要不要编前端
keywords:
  - fast-deploy
  - build.web.sh
  - BUILD_WEB_SKIP_HISTORY_REWRITE
  - deploy.sh
  - launch.dev.sh
  - cmd_ensure_frontend_dist
  - build:16g
  - 没改前端
  - install-service
  - 开机自启
  - SERVICE_USER
standard: 先按 code-push-routing 分流；有 PC 前端改动才 build.web；禁止平行 npm run build 后手写 commit/push
---

# fast-deploy 脚本入口（构建 / 部署）

- 日期：2026-10-03；分流澄清：2026-10-10
- 状态：已交付（文档化，供后续构建一律走脚本）

## 目标

主仓所有「构建前端、发 dist、本机起停、生产更新」只走 `fast-deploy/` 现有脚本。  
**源码-only 推送**（后端 / deploy / 记忆库）不走本篇的 `build.web.sh`，见 `principles/code-push-routing.md`。

## 何时读 / 禁止另起

- 何时读：已确认需要编 PC dist / 部署机更新 / H5 / pro-apps / 本机起停
- 禁止：没改前端却跑 `build.web.sh`；平行 `npm run build` 后手写 commit/push；对 develop 擅自 `--force`；新步骤另起顶层脚本

## 标准入口

| 场景 | 命令 | 说明 |
|------|------|------|
| 仅后端/deploy/记忆库 | `git push`（生产再 `deploy.sh update`） | **不**跑 `build.web.sh` |
| Web 构建并推送 dist | `BUILD_WEB_SKIP_HISTORY_REWRITE=1 ./fast-deploy/build.web.sh`（Windows 用 Git Bash） | **仅** PC 前端源有关变更后；只提交 `riveredge-frontend/dist` |
| Web 历史瘦身 + 推送 | `./fast-deploy/build.web.sh` | 需 `git-filter-repo`，`force-with-lease` |
| 部署机消费 dist | `./fast-deploy/deploy.sh update`（prod） | `cmd_ensure_frontend_dist`：有 Git dist 则不在服务器构建 |
| 部署机强制本机构建 | `ALLOW_SERVER_BUILD=1` + `deploy.sh build` | 弱机不推荐；`npm run build`（非 `build:16g`） |
| 移动端 H5 本地构建 | `./fast-deploy/build.mobile.web.sh` | `riveredge-app/mobile` → `web-dist`，默认不进主仓 |
| 部署机装 H5 | `./fast-deploy/deploy.sh install-h5` | 拉 `kuaigeyun-client`，Caddy `/mobile` |
| 统一部署向导 | `./fast-deploy/deploy.sh` / `dev` / `wizard` | check/install/configure/migrate/build/start/stop/status/update |
| 生产开机自启 | `./fast-deploy/deploy.sh install-service`（向导 BOOT） | 非 root；用户解析见下；缺 uv 自动装到服务用户 home |
| 本机开发起停 | `./fast-deploy/launch.dev.sh`（`with-h5` / `stop` / `status`） | 不走蓝绿；需蓝绿用 `deploy.sh dev` |
| Windows PS 起停 | `.\fast-deploy\launch.dev.ps1 withh5` | **勿**在 PS 里直接 `.\launch.dev.sh`（会另开 git-bash、无输出）；手机口 **8098** |
| 专业/定制组装 | `python fast-deploy/tools/workspace/compose.py` | 或 `deploy.sh pro-apps` |
| Linux 薄封装 | `linux/dev.sh` / `linux/prod.sh` | 设 `DEPLOY_MODE` 后 `fd_dispatch` |
| Windows PS | `windows/dev.ps1` / `windows/prod.ps1` | 逻辑在 `lib/common.ps1` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 入口说明 | `fast-deploy/README.md` |
| Web 发版脚本 | `fast-deploy/build.web.sh` |
| Git 历史/脏检查/push | `fast-deploy/lib/build_web_git.sh` |
| 部署总入口 | `fast-deploy/deploy.sh` → `lib/common.sh` `fd_dispatch` |
| 服务器构建 / 跳过构建 | `cmd_build` / `cmd_ensure_frontend_dist`（`common.sh`） |
| PS 对等实现 | `lib/common.ps1` `Invoke-Build` / `Ensure-FrontendDist` |
| 蓝绿 | `lib/blue_green.sh` / `blue_green.ps1` |
| 向导 | `lib/wizard.sh` |
| 移动 H5 | `build.mobile.web.sh`；`cmd_install_client_repo` |
| 配置样例 | `fast-deploy/config/deploy.env.example` |
| Caddy 模板 | `fast-deploy/templates/Caddyfile.template` |

## 构建链路（仅 Web 产物需要时）

1. 确认改动含 PC 前端（见 `principles/code-push-routing.md`）；否则只源码 push
2. 发版机 develop：前端相关源码稳定 → AOCI 对齐并提交 → 源码 commit（不含 dist）→ `BUILD_WEB_SKIP_HISTORY_REWRITE=1 ./fast-deploy/build.web.sh`
3. 生产机：`git pull` 得 tip 里 dist → `deploy.sh update` → 有 `index.html`+`login.html` 即跳过 npm
4. `deploy.sh build` 只给「允许服务器构建」或调试；不是 Gitee 发版入口

日常 Windows 必须带 `BUILD_WEB_SKIP_HISTORY_REWRITE=1`，否则会跑 filter-repo 并 `force-with-lease`。

## 扩展点

- 新部署步骤：挂 `fd_dispatch` / `KNOWN_CMDS`
- 新前端产物检查：与 `cmd_ensure_frontend_dist`（须含 `login.html`）对齐
- H5 / 专业包：分别走 `install-h5` 与 `compose.py`，不要写进 `build.web.sh`

## 开机自启（Linux systemd）

- 运行用户优先级：`deploy.env` 的 `SERVICE_USER` → `SUDO_USER` → 当前用户 → `$PROJECT_ROOT` 属主 → **已安装 unit 的 `User=`**；**禁止** `User=root`。root 直登且目录属主也是 root 时，脚本会读 `/etc/systemd/system/riveredge-backend.service` 并写回 `SERVICE_USER`；仍失败则须人工写入 `SERVICE_USER`。
- `prepare_systemd_prerequisites`：服务用户无 uv 时 `ensure_uv_for_user` 自动 pip/官方脚本装到其 `~/.local/bin`，勿把 root 的 uv 写进 unit
- 向导 BOOT 菜单展示运行用户、uv/caddy 就绪态；失败信息含可复制手装命令
- **203/EXEC**：`check_systemd_exec_scripts` 纳入 `deploy.sh check`；`ensure_systemd_exec_scripts_ready` 在 `install-service` / `start_prod_via_systemd` / `fix_systemd_runtime_permissions` 去 CRLF + `chmod +x`；仓库侧 `linux/.gitattributes` + `100755`
- 真源：`lib/common.sh` 的 `resolve_service_user` / `ensure_uv_for_user` / `ensure_systemd_exec_scripts_ready` / `cmd_install_service`

## 踩坑

- `journalctl` 报 `deploy.env: Permission denied` 且 `riveredge-backend` 重启计数狂涨：服务用户读不到 `fast-deploy/config/deploy.env`（常见 root 编辑后 `chmod 600`）。`fix_systemd_runtime_permissions` 会 chown 配置目录与 `deploy.env`；`install-service` / systemd `start` 启动前会跑。应急：`sudo ./fast-deploy/deploy.sh install-service` 或手动 `chown` 给 `SERVICE_USER`。
- `journalctl` 报 `status=203/EXEC` + `Permission denied`：包装脚本无 +x 或含 `\r`（Windows 检出）。先 `./fast-deploy/deploy.sh check`，再 `install-service` / `start`（会自动 `ensure_systemd_exec_scripts_ready`）。
- PowerShell 执行 `.\fast-deploy\launch.dev.sh`：Windows 把 `.sh` 关联到 `git-bash.exe`，Cursor 终端无日志、exit 0，手机端未起。改用 `.\fast-deploy\launch.dev.ps1 withh5` 或 Git Bash。
- 手机 H5 开发口默认 **8098**，不是 8081（Hyper-V 保留段）。
- 工作区除 dist（及蓝绿槽、`.perf`）外必须干净，否则 `build_web_assert_source_tree_committed` 失败；**正式 AOCI 资产**（`aoci.txt` / `aoci.*.txt` / 放行的 `.aoci/config.json` 等）应已提交，勿故意排除——未跟踪的正式索引会挡住脚本；`.aoci` 下 lock/ledger/batch 助手文件仍勿提交（见 `.cursor/rules/aoci-git-commit.mdc`）
- 跟踪远程以 `@{upstream}` 为准，勿写死 origin
- 推送 HTTPS 用组织令牌 `oauth2:<token>`
- `cmd_build` 用 `npm run build`；发版脚本用 `build:16g`
- 阿里云 PyPI 偶发对 `uv.lock` hash 路径 `.whl.metadata` 404（如 `python-dotenv`）：`uv_sync_backend_with_fallback` 回退清华/官方，**成功源须写回父进程 `UV_INDEX_URL`**（勿在子 shell 里 export）；迁移用 `uv run --no-sync aerich upgrade` 禁止二次拉包。仍可显式 `UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/`

## 关联

- `principles/reuse-existing-patterns.md`
- `fast-deploy/README.md`
- Vault SOP：`E:\AI-Memory\30-Knowledge\MES-Codebase\web-build-push-sop.md`
- Vault 决策：`E:\AI-Memory\40-Decisions\2026-09-27-web-build-push-flow.md`
