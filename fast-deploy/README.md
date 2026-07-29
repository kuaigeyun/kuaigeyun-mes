# fast-deploy 快速部署

统一部署入口，支持 **Linux** 与 **Windows（Git Bash）**。完整部署说明见 [docs/部署指南.md](../docs/部署指南.md)。

<div style="padding:12px 16px;margin:12px 0;background-color:#fffbe6;border:1px solid #ffe58f;border-left:4px solid #faad14;border-radius:4px;color:#614700;">
<strong style="color:#d48806;">⚠️ 预览说明</strong><br/>
当前版本仍在开发中，API 与数据库结构可能随版本变化，<strong>不适合作为正式生产环境</strong>长期运行。
</div>

<div style="padding:12px 16px;margin:12px 0;background-color:#fff2f0;border:1px solid #ffccc7;border-left:4px solid #ff4d4f;border-radius:4px;color:#434343;">
<strong style="color:#cf1322;">⛔ 部署建议</strong><br/>
<ol style="margin:8px 0 0 0;padding-left:20px;">
<li><strong>部署环境</strong>：<strong>建议在空白服务器或虚拟机</strong>上完成首次部署与升级验证；<strong>不建议</strong>在已运行生产业务的服务器上进行试装或试升级，以免对现有系统造成影响。</li>
<li><strong>生产环境部署</strong>：若必须在已有业务的服务器上执行安装、<code>update</code> 或数据库迁移，<strong style="color:#cf1322;">须先完成完整备份</strong>（PostgreSQL 全库、<code>riveredge-backend/.env</code>、<code>fast-deploy/config/deploy.env</code>、上传目录等），并验证备份可还原；<strong style="color:#cf1322;">未备份即操作，相关风险由部署方自行承担。</strong></li>
</ol>
</div>

## 推荐入口

```bash
cd riveredge
./fast-deploy/deploy.sh              # 生产 · 8 阶段向导
./fast-deploy/deploy.sh dev            # 开发模式
./fast-deploy/deploy.sh wizard         # 显式进入向导
```

子命令 `check / install / configure / migrate / build / start / stop / status / update` 可用于单步操作。

`update` / 向导安装会在 `riveredge-backend/.env` 写入发版元数据（`GIT_SHA`、`INSTALL_INSTANCE_ID`、`BUILD_GIT_REMOTE` 等），供构建来源展示与可选实例统计。详见 [`docs/telemetry-disclosure.md`](../docs/telemetry-disclosure.md)；关闭登记：`INSTALL_TELEMETRY_ENABLED=false`。

## 脚本对照

| 场景 | 命令 |
|------|------|
| **统一入口（推荐）** | [`deploy.sh`](deploy.sh) |
| **本地快速启动**（开发机一键起停） | [`launch.dev.sh`](launch.dev.sh)（加 `with-h5` 同时起手机 Expo Web） |
| **构建并发布**（dist + 改动 commit/push） | [`build.web.sh`](build.web.sh) |
| **移动端 H5**（本地构建 → `web-dist`） | [`build.mobile.web.sh`](build.mobile.web.sh) |
| **部署机安装 H5**（拉私仓并部署到 Caddy `/mobile`） | `./fast-deploy/deploy.sh install-h5`（向导扩展应用 → `[3] 安装 H5`；**可选**，缺省不阻断主仓 install/update） |
| **专业/定制应用组装** | [`tools/workspace/compose.py`](tools/workspace/compose.py)（说明见 [`tools/workspace/README.md`](tools/workspace/README.md)） |
| Linux | [`linux/dev.sh`](linux/dev.sh) / [`linux/prod.sh`](linux/prod.sh) |
| Windows PowerShell | [`windows/dev.ps1`](windows/dev.ps1) / [`windows/prod.ps1`](windows/prod.ps1) |
| Windows 组件安装 | [`windows/install-component.ps1`](windows/install-component.ps1) |

## 环境要求（摘要）

Node.js 22+ · Python 3.12+（系统）/ 3.11（uv 虚拟环境）· uv · npm · PostgreSQL 15+ · Caddy（生产）。**无需 Redis**（Taskiq + PostgreSQL）。

## 默认端口

| 模式 | Web | API |
|------|-----|-----|
| 开发 | :8100（Vite） | :8200 |
| 生产（IP） | :8080（Caddy） | 经 Caddy `/api` |
| 生产（域名 + HTTPS） | :443（Caddy 自动证书） | 经 Caddy `/api` |

生产向导 / `configure` 会询问：**仅 IP** 或 **域名 + 自动 HTTPS**（写入 `deploy.env` 的 `CADDY_DOMAIN`、`CADDY_ENABLE_LETSENCRYPT`）。

## 蓝绿部署（可选，`update` 零停机）

默认 **关闭**（`BLUE_GREEN_DEPLOY=0`），行为与原先 stop → migrate → start 完全一致。

在 `fast-deploy/config/deploy.env` 中设置 `BLUE_GREEN_DEPLOY=1` 后，`update` 会：

- **生产**：新 backend 在 inactive 端口就绪 → Caddy reload 切流量 → 原子切换 `dist-live` → 再停旧 backend
- **开发**：`:8200` dev API 代理固定入口，Vite 无需重启；backend 在 `8201`/`8202` 双槽切换

| 变量 | 默认 | 说明 |
|------|------|------|
| `BLUE_GREEN_DEPLOY` | `0` | `1` 启用蓝绿 update |
| `BACKEND_PORT_BLUE` | `8201` | 蓝槽 backend |
| `BACKEND_PORT_GREEN` | `8202` | 绿槽 backend |
| `WORKER_DRAIN_TIMEOUT` | `60` | Worker 优雅退出秒数 |

**关闭蓝绿（回到原先部署方式）**：设 `BLUE_GREEN_DEPLOY=0` → `./fast-deploy/deploy.sh stop` → `start`。无需改数据库。

`./fast-deploy/deploy.sh status` 在启用后会显示 active 槽位与健康状态。`launch.dev.sh` 不经过蓝绿逻辑；需蓝绿时请用 `./fast-deploy/deploy.sh dev`。

详细说明与回滚边界见 [部署指南](../docs/部署指南.md#蓝绿部署可选)。

## Windows 要点

- Git Bash 运行 `./fast-deploy/deploy.sh`；依赖安装走 PowerShell
- winget 不可用时自动 fallback（MSI / 官方安装包 / 便携版）
- Caddyfile 使用 `C:/...` 原生路径，避免静态资源 404

详细故障排查与运维命令见 [部署指南](../docs/部署指南.md)。
