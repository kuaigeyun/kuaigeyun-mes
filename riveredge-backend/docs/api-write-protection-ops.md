# API 写防护体系：改动总结与运维手册

> 日期：2026-09-23  
> 范围：全站 `/api/*` 写接口（POST/PUT/PATCH/DELETE）  
> 仓库：`kuaigeyun/riveredge-backend` + 前端 `riveredge-frontend` / `kuaigeyun-client` 移动端

本文是永久记忆文档：记录本次实现内容、开关位置、白名单如何加、对接方怎么配、权限与运维注意点。

---

## 一、本次改动摘要（做了什么）

### 1. 官方客户端渠道门禁（全站）

- **中间件**：`core/middleware/client_channel_write_guard_middleware.py`
- **规则**：写请求必须带白名单 `X-Client-Channel`，否则 **403**
- **白名单渠道码**：`pc` / `station` / `android` / `ios` / `mobile_h5` / `miniprogram` / **`integration`**
- **别名**：`web`→pc，`api`/`sync`/`connector`→integration 等（见 `core/utils/client_channel.py`）
- **销售订单创建**额外兜底：`assert_allowed_sales_order_create`（无渠道但有合同等上游时业务层可放行；全站门禁开启时通常仍需渠道头）

### 2. 写限流（全站，内存）

- **中间件**：`core/middleware/api_write_rate_limit_middleware.py`
- **默认**：普通写 120 次/用户/分钟；关键写（审核/下推/确认等）30 次/用户/分钟
- **超限**：HTTP **429** + `Retry-After: 60`
- **注意**：进程内计数，多 Worker 额度不共享（要跨机需以后上 Redis）

### 3. 幂等（全站，内存）

- **中间件**：`core/middleware/api_idempotency_middleware.py`
- **显式键**：请求头 `Idempotency-Key` → 成功 JSON 短时回放（头 `X-Idempotency-Replay: 1`）
- **软去重**：关键路径无键时，同用户同 METHOD+PATH 约 **2.5s** 内重复 → **409**「请勿重复提交」
- **PC/App**：写请求已自动生成 `Idempotency-Key`（重试复用同一键）

### 4. 审计与告警信号

- 操作日志内容增加 `channel=`、`idem=`（`operation_log_middleware.py`）
- 拒绝/限流/幂等命中：`core/security/security_signals.py` 打 warning 日志（不写 DB）

### 5. 工具（供业务服务按需用，未全表强制）

- `core/utils/cas_update.py`：`update_where_expected` / `assert_row_version`
- 库存过账锁/流水幂等仍走原有 `stock_posting`（未改坏）

### 6. 刻意未做（避免伤性能/大迁库）

- 全业务表加 `version` 乐观锁字段
- 所有 UPDATE 改成条件更新（需逐服务改，工具已备好）
- 多机 Redis 限流/幂等
- 网关 WAF（运维侧）

---

## 二、你需要配合的操作（必读）

### A. 重启后端

改的是中间件，**必须重启** `riveredge-backend`（uvicorn）后才生效。

### B. 确认 `.env` 开关（人工可调）

文件：`riveredge-backend/.env`（可参考 `.env.example`）

```env
# —— 渠道门禁（默认 true）——
CLIENT_CHANNEL_WRITE_GUARD_ENABLED=true

# —— 写限流（默认 true）——
API_WRITE_RATE_LIMIT_ENABLED=true
API_WRITE_RATE_LIMIT_PER_MINUTE=120
API_CRITICAL_WRITE_RATE_LIMIT_PER_MINUTE=30

# —— 幂等（默认 true）——
API_IDEMPOTENCY_GUARD_ENABLED=true
API_IDEMPOTENCY_TTL_SECONDS=300
API_IDEMPOTENCY_SOFT_TTL_SECONDS=2.5

# —— integration 渠道 IP 白名单（空=不限制）——
# 多个 IP 用英文逗号分隔
INTEGRATION_CLIENT_IP_ALLOWLIST=

# —— 开放 API（金蝶式账套鉴权，默认 true）——
OPEN_API_INTEGRATION_CREDENTIAL_REQUIRED=true
OPEN_API_TOKEN_EXPIRE_MINUTES=120
```

**应急关闭整站写防护（不推荐，仅排障）**：

```env
CLIENT_CHANNEL_WRITE_GUARD_ENABLED=false
API_WRITE_RATE_LIMIT_ENABLED=false
API_IDEMPOTENCY_GUARD_ENABLED=false
OPEN_API_INTEGRATION_CREDENTIAL_REQUIRED=false
```

改完 `.env` 后再次重启后端。

---

## 三、白名单分别在哪加？

系统里有两类「白名单」，不要混淆。

### 1）客户端渠道白名单（谁可以写 API）

| 要加什么 | 改哪里 | 说明 |
|---------|--------|------|
| 新的官方端渠道码（如新 App） | 代码：`src/core/utils/client_channel.py` → `CLIENT_CHANNEL_DEVICE_LABELS` | 例如增加 `"pad": "平板端"`，前后端都要发这个码 |
| 渠道别名 | 同文件 `normalize_client_channel` 的 `aliases` | 如 `"tablet": "pad"` |
| 正式对接脚本 | 系统「开放 API」发账套+应用秘钥换票，且请求头 `X-Client-Channel: integration` | 普通用户 JWT 在 integration 渠道会被 403 |
| 对接机器 IP 限制 | `.env` → `INTEGRATION_CLIENT_IP_ALLOWLIST` | 仅当渠道为 `integration` 时校验；空=不限 IP |

**前端已自动带渠道，一般不用你配：**

- PC：`riveredge-frontend/src/utils/clientChannel.ts`（可用环境变量 `VITE_CLIENT_CHANNEL`，默认 pc；工位可设 `station`）
- 移动：`kuaigeyun-client/.../platform/clientChannel.ts`（android/ios/mobile_h5/miniprogram）

### 1.1）开放 API 对接步骤（推荐）

1. 打开 **基础设施 → 开放 API**（`/infra/open-api`），选择/确认组织上下文后查看账套 ID，新建应用并**按单据模块 + 动作勾选授权**（目录覆盖销售/采购/仓存/生产/质检/委外/计划交付/售后物流/主数据等；如仅 `sales-order:read`＝GET，或再加 `create`＝POST 新建）
2. 换票：`POST /api/v1/open/auth/token`，body：`{"acct_id","app_id","app_secret"}`（页面「API 使用文档」含 curl / Python 完整示例）
3. 业务请求携带：`Authorization: Bearer <open_token>`、`X-Client-Channel: integration`、`X-Tenant-ID`；写操作另加 `Idempotency-Key`
4. 未授权的权限码返回 `403 OPEN_API_GRANT_DENIED`（与 PC 角色 RBAC 独立，只看应用 grants）

可授权单据目录由 `src/core/config/open_api_module_catalog.py` 维护（可用 `_gen_open_api_catalog.py` 按 manifest 重生成）。权限码须与 `apps/*/manifest.json` 一致（主数据为 `master-data:…`，非历史简化写法）。

**权限与 HTTP 对照：**

| 权限动作 | HTTP | 说明 |
| --- | --- | --- |
| `*:read` | GET | 列表/详情 |
| `*:create` | POST（集合路径） | 新建 |
| `*:update` | PUT / PATCH | 修改 |
| `*:delete` | DELETE | 删除 |
| `*:submit` / `audit` / `revoke` / `execute` | POST 子路径 | 业务动作 |

**对接方示例（开放 Token）：**

```http
POST /api/v1/apps/kuaizhizao/sales-orders HTTP/1.1
Authorization: Bearer <open_access_token>
X-Tenant-ID: 1
X-Client-Channel: integration
Idempotency-Key: <每次业务操作一个 UUID，重试不变>
Content-Type: application/json
```

```bash
# 换票
curl -X POST 'https://your-host/api/v1/open/auth/token' \
  -H 'Content-Type: application/json' \
  -d '{"acct_id":"<账套ID>","app_id":"<AppId>","app_secret":"<AppSecret>"}'

# 只读列表（需授权 kuaizhizao:sales-order:read）
curl -X GET 'https://your-host/api/v1/apps/kuaizhizao/sales-orders' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'X-Tenant-ID: 1' \
  -H 'X-Client-Channel: integration'
```

**IP 白名单示例（仅 integration）：**

```env
INTEGRATION_CLIENT_IP_ALLOWLIST=127.0.0.1,10.0.0.8,192.168.1.100
```

注意：若前面有反向代理，需保证后端拿到的是真实客户端 IP（`X-Forwarded-For` / 现有 `get_client_ip`）。

### 2）公开写接口豁免名单（不要求渠道）

文件：`src/core/utils/interactive_client_guard.py`

- `_EXEMPT_EXACT_PATHS`：精确路径（登录/注册/超管登录/站点 LOGO 激活/`/api/v1/open/auth/token` 等）
- `_EXEMPT_PREFIXES`：前缀（生物识别、企微登录等）

**若新增「必须匿名可写」的公开 API**，把路径加进上述豁免，否则会被 403。

### 3）关键写路径（更严限流 + 软幂等）

文件：`src/core/security/write_path_policy.py` → `_CRITICAL_PATH_RE`

匹配如：`/submit` `/approve` `/confirm` `/push-*` `/release` `/execute` 等。

若新动作路径命名不在正则内，只会走「普通写限流」，不会走 2.5s 软去重。需要时改正则。

---

## 四、权限码怎么加？（与本次中间件的关系）

本次**没有新增**业务权限码；写防护是「渠道 + 限流 + 幂等」，叠在原有「登录 Token + 权限码 + 租户」之上。

### 现有权限仍要人工在后台配

1. 登录管理端 → 角色/权限管理（或组织权限策略）
2. 给角色勾选对应应用权限码（如快制造销售订单相关码）
3. 用户绑定角色

权限码定义一般在各应用 manifest / 权限种子 / `require_permission_codes` 路由上；**加新接口时**：

1. 路由上挂 `Depends(require_permission_codes(["xxx"]))` 或应用内 `_kuaizhizao_route_access`
2. 在权限目录/种子中注册该码（名称、模块）
3. 运维在租户里给角色勾选

**对接账号建议：**

- 单独建「系统对接」角色，只开必要单据权限
- 固定使用 `X-Client-Channel: integration`
- 需要时配 `INTEGRATION_CLIENT_IP_ALLOWLIST`
- 不要用超级管理员 Token 做日常对接

---

## 五、前端 / 发布侧你要做的

1. **重新构建并发布 PC 前端**（`api.ts` 已自动加 `Idempotency-Key` + 原有 `X-Client-Channel`）
2. **重新构建并发布移动端**（同上）
3. 工位/Kiosk 若用独立包，确认 `VITE_CLIENT_CHANNEL=station`（或实际渠道码）
4. 自测：浏览器正常建销售订单；用无渠道的 curl 打写接口应 403

**curl 自测（应失败）：**

```bash
curl -X POST "http://127.0.0.1:8200/api/v1/apps/kuaizhizao/sales-orders" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: 1" \
  -H "Content-Type: application/json" \
  -d "{...}"
# 期望 403 AUTHORIZATION_ERROR
```

**curl 自测（应成功，若权限与数据合法）：**

```bash
curl -X POST "http://127.0.0.1:8200/api/v1/apps/kuaizhizao/sales-orders" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: 1" \
  -H "X-Client-Channel: pc" \
  -H "Idempotency-Key: test-001" \
  -H "Content-Type: application/json" \
  -d "{...}"
```

---

## 六、日志与排障

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 写接口全 403 | 未带 `X-Client-Channel` 或码不在白名单 | 前端未发版 / 脚本补头 |
| integration 403「IP 不在允许列表」 | IP 白名单启用且未命中 | 改 `INTEGRATION_CLIENT_IP_ALLOWLIST` 或清空 |
| 429 | 触发限流 | 降频或调大 `.env` 额度后重启 |
| 409 请勿重复提交 | 关键动作连点 / 软幂等 | 正常；或拉长操作间隔 |
| 同键第二次立刻成功且带 Replay | 显式幂等回放 | 正常 |

日志关键字：`security_signal`、`client_channel_reject`、`rate_limited`、`idempotency_`

---

## 七、关键代码索引

| 模块 | 路径 |
|------|------|
| 渠道解析/白名单 | `src/core/utils/client_channel.py` |
| 渠道门禁 + 豁免 + 销售订单断言 | `src/core/utils/interactive_client_guard.py` |
| 渠道中间件 | `src/core/middleware/client_channel_write_guard_middleware.py` |
| 限流中间件 | `src/core/middleware/api_write_rate_limit_middleware.py` |
| 幂等中间件 | `src/core/middleware/api_idempotency_middleware.py` |
| 关键路径正则 | `src/core/security/write_path_policy.py` |
| 配置项 | `src/infra/config/infra_config.py` + `.env` |
| 注册 | `src/server/main.py` |
| 条件更新工具 | `src/core/utils/cas_update.py` |
| PC 自动头 | `riveredge-frontend/src/services/api.ts` |
| 移动自动头 | `kuaigeyun-client/riveredge-app-mobile/src/services/api.ts` |

---

## 八、后续可选（未做，需立项）

1. 核心单据表加 `version` 乐观锁并在改单接口校验  
2. 销售/出库关键流转全面改用 `update_where_expected`  
3. Redis 共享限流与幂等（多机）  
4. 网关/WAF 外围限流  

---

## 九、一句话给运维

**官方客户端自动带头；对接必须 `X-Client-Channel: integration`（可选 IP 白名单）；限流/幂等默认已开，改 `.env` 后重启后端；权限码仍在角色里人工勾选，本次未改权限模型。**
