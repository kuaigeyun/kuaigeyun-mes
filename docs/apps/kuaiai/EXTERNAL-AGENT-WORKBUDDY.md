# KU-Bridge 外部 Agent（WorkBuddy）对接说明（实验室）

> **实验室能力，非正式 GA。** 接口、工具名与配置字段可能变更；生产使用前请自行评估风险。

## 目标

让 WorkBuddy 等外部 Agent 经 **MCP** 只读访问租户 MES 数据，产品入口在 **KU-AI → 设置 → 外部 Agent（实验室）** 与 **能力矩阵 KU-Bridge**。

本能力**不是** MES「应用连接器」市场里的卡片；WorkBuddy 侧在 **企业 Connector 管理** 中登记 MCP URL。

## 架构

```text
WorkBuddy Agent
  → WorkBuddy 企业自定义连接器（HTTPS MCP）
  → kuaigeyun-pro/tools/workbuddy-mcp（Sidecar）
  → 开放 API（integration 渠道 + 应用 grants）
  → /api/v1/apps/kuaizhizao/* 只读 GET
```

## 启用步骤

1. 租户已安装并激活 **KU-AI**（专业版 License）。
2. **KU-AI → 设置**：打开「外部 Agent / WorkBuddy（实验室）」开关。
3. **基础设施 → 开放 API**：新建应用，仅勾选只读授权（首版建议）：
   - `kuaizhizao:sales-order:read`
   - `kuaizhizao:work-order:read`
   - `kuaizhizao:warehouse-management-inventory:read`（库存查询走报表接口）
4. 生产 `.env`：按需配置 `INTEGRATION_CLIENT_IP_ALLOWLIST`（MCP 服务器出口 IP）。
5. 部署 Sidecar：见 `kuaigeyun-pro/tools/workbuddy-mcp/README.md`。
6. WorkBuddy / `~/.workbuddy/mcp.json`：`type` 为 **`http`**，URL 为 **`https://<生产域名>/mcp`**（方案 B，与 MES 连接器「只填域名」一致）。

### 生产方案 B（主站 `/mcp` → Sidecar，fast-deploy）

在 **生产机**（与 MES 同机 Caddy）：

1. `deploy.env` 配置 `CADDY_DOMAIN`、`PRO_REPO_PATH`（kuaigeyun-pro）。
2. 首次 `./fast-deploy/deploy.sh update` 会生成 `fast-deploy/config/workbuddy-mcp.env`（若不存在）；填齐 `OPEN_API_*`。
3. 再次 `update` 或 `prod start`：脚本自动写入 `WORKBUDDY_MCP_ENABLE=1`、生成 Caddy `/mcp` 反代、uv sync Sidecar、启动 Sidecar（systemd 或 nohup）。
4. 校验：`curl -sI https://<域名>/mcp` **不应**再是 `text/html` + 8904（Sidecar 未起时可能 502）。
5. WorkBuddy：`type: http`，`url: https://<域名>/mcp`。

### 公网仍是 HTML（8904 字节）时

**在 Windows 开发机 push / curl 不会改变生产 Caddy**；必须在 **Linux 生产机** 拉代码并 `update`。

| 现象 | 含义 |
|------|------|
| `Content-Type: text/html` 且 `Content-Length: 8904` | `/mcp` 仍被 SPA `try_files` 吃掉，Caddy **没有**生效的 `handle /mcp*` |
| `502` / 非 HTML | 反代已挂上，Sidecar 未起或崩溃 |
| MCP 正常 | 通常非 HTML（如 405/406/JSON），且本机 `curl -sI http://127.0.0.1:8765/mcp` 有响应 |

生产机一键诊断：

```bash
cd /path/to/kuaigeyun
git pull origin develop
./fast-deploy/deploy.sh prod diag-workbuddy-mcp
```

常见未生效原因：

1. 生产未 `git pull` 到含 `{{WORKBUDDY_MCP_CADDY_BLOCK}}` 的 fast-deploy 版本。
2. `fast-deploy/config/workbuddy-mcp.env` 未填齐 `OPEN_API_*`（且未显式 `WORKBUDDY_MCP_ENABLE=1`）→ 脚本**故意**不写反代，避免误暴露。
3. 只改了 Gitee 代码，未在生产执行 `./fast-deploy/deploy.sh prod update`（重生 Caddyfile + reload + 启 Sidecar）。
4. `PRO_REPO_PATH` 未指向含 `tools/workbuddy-mcp` 的 pro 仓。

## Sidecar 环境变量

| 变量 | 说明 |
|------|------|
| `RIVEREDGE_BASE_URL` | 例如 `https://your-host` |
| `OPEN_API_ACCT_ID` | 账套 ID |
| `OPEN_API_APP_ID` | 应用 ID |
| `OPEN_API_APP_SECRET` | 应用秘钥 |
| `OPEN_API_TENANT_ID` | 租户 ID（`X-Tenant-ID`） |

Sidecar 自动换票并缓存 Token；所有业务请求带 `X-Client-Channel: integration`。

## 首版 MCP 工具（只读）

| 工具 | 开放 API 路径 |
|------|----------------|
| `list_sales_orders` | GET `/api/v1/apps/kuaizhizao/sales-orders` |
| `get_sales_order` | GET `/api/v1/apps/kuaizhizao/sales-orders/{uuid}` |
| `list_work_orders` | GET `/api/v1/apps/kuaizhizao/work-orders` |
| `get_work_order` | GET `/api/v1/apps/kuaizhizao/work-orders/{uuid}` |
| `search_inventory` | GET `/api/v1/apps/kuaizhizao/reports/inventory/material-balances` |

## 禁止事项

- 勿用普通用户 JWT 或 PC 渠道对接 WorkBuddy。
- 勿将 WorkBuddy 配进 MES「应用连接器」并期望外打进 MES。
- 首版勿开放写操作、KU-Act、`propose_action` 经 integration 外放。
- 勿直连数据库；权限以开放 API grants 为准。

## 相关文档

- [API 写防护与开放 API 运维](../../riveredge-backend/docs/api-write-protection-ops.md)
- [KU-AI ROADMAP](./ROADMAP.md)
