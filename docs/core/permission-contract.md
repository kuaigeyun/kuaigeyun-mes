# 系统权限契约（RBAC）

与后端 [`permission_contract.py`](../../riveredge-backend/src/core/config/permission_contract.py)、前端 [`permissionContract.ts`](../../riveredge-frontend/src/utils/permissionContract.ts) 对齐。Cursor 规则见 [`.cursor/rules/permission-contract.mdc`](../../.cursor/rules/permission-contract.mdc)。

## 权限码

- 格式：`{app}:{module}:{action}`。
- `action` 仅来自 `STANDARD_ACTIONS`（[`permission_action_spec.py`](../../riveredge-backend/src/core/config/permission_action_spec.py)）。
- **唯一声明**：应用 `manifest.json` 的 `permissions` + 核心注册表；改码后须权限同步。

## 基线权限

- 真源：`PermissionRegistryService.BASELINE_PERMISSION_CODES`（前端镜像 `BASELINE_PERMISSION_CODES`）。
- 当前：个人中心 8 码（`system:user-profile|preference|message|task` × `read|update`）。
- 新建角色 / 预设 / 矩阵保存 / 权限同步强制授予；矩阵不可取消。

## 后端

| 场景 | 真源 | 禁止 |
|------|------|------|
| 新业务 / 非标准 REST | `require_permission_codes(...)` | 在 `access.py` 堆路径特例而不改 manifest |
| 应用标准 REST | `require_*_module_access("裸module")` 等契约 helper | 传入 `master-data:material` 等含 app 前缀的 module（双前缀） |
| 审核 | `review_permission_codes` / manifest `audit` | 用 `update` 代替审核 |
| 细粒度 RBAC | `require_permission_codes(..., check_abac=False)` 默认 | 用 ABAC 替代未授予的 RBAC |

`require_module_access(app, module)` 为遗留路径推断，新代码禁止用于 master-data / kuaizhizao / kuaicaiwu / haoligo 业务 API。

### 应用 module 参数

`require_master_data_module_access("material")` 只收 **manifest 裸 module**（如 `material`、`process:route`），禁止 `master-data:material`。误传会导致 `master-data:master-data:material:read` 双前缀 403。

迁移期 `_normalize_module_code` 可剥前缀，但扫描器对双前缀调用 **fail-on high**；新代码不得依赖剥前缀。

## 前端

| 场景 | 真源 | 禁止 |
|------|------|------|
| 按钮 / 行操作 | `useResourcePermissions('app:module')` | HaoliGO 页直接 `hasPermission` |
| 审核 / 打印 | `hasReviewPermission` / `canPrint` | `hasPermission(..., 'update')` 门控审核 |
| 外协身份 | `role_type === 'external'` 且 `external_partner_type` 非空 | 角色名正则 / 权限推断厂内外 |

## 数据范围

RBAC 管「能否操作」；`DataScopeService` 管「能看哪些行」。不得用 ABAC 替代缺失的 RBAC 码。

## 宿主页跨模块读（复合页）

**默认严格分权**：宿主页（如物料）拉关联模块列表，须有该模块 `:read`；无权限则不请求，用宿主详情快照回显，区块隐藏或控件灰显。

**附属只读白名单**：仅 [`affiliate_read_allowlist.py`](../../riveredge-backend/src/core/config/affiliate_read_allowlist.py) 登记的 GET 允许 `宿主:read OR 模块:read`。新增 OR 须先登记条目并 PR 审阅，禁止在 `*_route_access.py` 内联堆 OR。

**写操作**：改默认 BOM、设计器、批量改路线等仍须各模块对应 action（如 `engineering-bom:update`），白名单不覆盖写。

**错误面隔离**：仅 **主资源** API 失败可设置宿主 `*DetailError` / 整页 Result（如 `materialApi.get`）。关联图纸 / 路线 / 仓库 / 客户等 **次要** 请求失败：独立 try/catch，`console` 或空态，不得用 `getApiErrorMessage` 把次要 403 显示为「权限不足」阻塞宿主内容。

**引用回显**（与附属 GET OR、复合页严格分权是不同场景，勿混用）：

| 职责 | 唯一真源 | 不是真源 |
|------|----------|----------|
| 矩阵是否出现「回显」、是否注册 `:display` 码 | 应用 `manifest.json` → `reference_resources`（系统级见 `core_reference_resources.py`） | `module_references`、Provider、宿主权限 |
| 引用下拉/解析能否通过 | 用户具备目标 `permission_prefix:read` **或** `:display` | 宿主 `create/update/read`、`module_references` 隐式 |
| 宿主「我会引用谁」（文档/扫描完整性） | `module_references`（目标必须已在 `reference_resources`） | 不得当授权放行 |
| 引用 API 如何取数 | `reference_display/setup.py` Provider（运行实现） | 不决定矩阵有无回显 |
| 复合页次要 list 的 OR | `affiliate_read_allowlist.py` | 与回显无关 |

前后端应用 manifest 的 `reference_resources` 必须同改；改后须权限同步。新建角色与同步（切流回填 / 新建 display 码）默认授予全部非敏感 `:display`；取消后同步不强制恢复。

主数据复合页仍默认严格分权 + 快照，附属 GET OR 仅走 `affiliate_read_allowlist`。

## 展示与矩阵

- 矩阵勾选顺序：`manifest.json` → `permissions` 数组下标。
- 操作文案：`ACTION_DISPLAY_LABELS` → 同步 `core_permissions.name`。
- **`display`（回显）**：仅来自 `reference_resources`；矩阵可见、可取消；文案为「回显」。

## 自检

```bash
cd riveredge-backend && python scripts/scan_permission_bypass.py --fail-on high
```

职责分工见 [`permission-responsibility.md`](./permission-responsibility.md)。
