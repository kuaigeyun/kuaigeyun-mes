# 系统权限契约

本文档为 RiverEdge RBAC 与引用资源权限的权威说明，与 `.cursor/rules/permission-contract.mdc` 一致。

## 权限码格式

- 格式：`{app}:{module}:{action}`
- `action` 仅来自 `permission_action_spec.STANDARD_ACTIONS`
- **唯一声明**：应用 `manifest.json` 的 `permissions` + 核心 `CORE_PERMISSION_CODES`

## 三层职责

| 层 | 问题 | 机制 |
|----|------|------|
| 功能 RBAC | 能否打开管理页 / 执行操作？ | 角色 → `core_permissions` |
| 引用展示 | 能否在其他单据下拉/回显？ | `:display` 或宿主 `module_references` 隐式授予 |
| 数据范围 | 能看见哪些行？ | `DataScopeService`（display API 同样 apply） |

## 引用资源（manifest 层）

### `reference_resources`

标记可被跨页面引用的基础数据。存在即表示该模块可被其他页面选择，**不**等同于管理页权限。

```json
"reference_resources": {
  "supply-chain:customer": {
    "permission_prefix": "master-data:supply-chain:customer",
    "display_fields": ["id", "uuid", "code", "name", "label"],
    "data_scope_key": "master-data:supply-chain:customer"
  }
}
```

- 全局 resource_key：`{app}:{local_key}`（如 `master-data:supply-chain:customer`）
- 同步时自动注册 `{permission_prefix}:display` 至 `core_permissions`
- `sensitive: true` 的资源禁止进入 registry，禁止隐式授予

### `module_references`

宿主业务模块声明引用的基础数据，用于 **display 隐式授权**：

```json
"module_references": {
  "sales-order": [
    "master-data:supply-chain:customer",
    "master-data:material"
  ]
}
```

用户拥有 `kuaizhizao:sales-order:read|create|update` 任一权限时，可引用上述资源的 display API，**无需** `master-data:supply-chain:customer:read`。

Core 系统模块使用 `CORE_MODULE_REFERENCES`（如 `system:user` → 客户/供应商/部门）。

## Display API

| 端点 | 用途 |
|------|------|
| `GET /api/v1/core/reference/display-search` | 下拉搜索 |
| `POST /api/v1/core/reference/display-resolve` | id/uuid 回显 |

鉴权：`AccessControlService.check_reference_display`（显式 read/display 或宿主隐式授予）。

前端：`referenceDisplay.ts` / `UniReferenceSelect`；选择器**不得**直接调用 list API 加载选项。

## 角色矩阵

`:display` 权限**不在**角色功能矩阵展示（隐式授予为主）；`:read` 等管理权限照常配置。

## 禁止旁路

- 禁止用宿主 `create/update` 替代目标资源的管理 action
- 禁止选择器静默吞掉 403 返回空数组
- 禁止在 `access.py` 堆路径特例而不改 manifest

## 自检

```bash
cd riveredge-backend && python scripts/scan_permission_bypass.py --fail-on high
```

## 控制栈与职责

完整分层说明见 [permission-responsibility.md](./permission-responsibility.md)。**仅允许**以下层参与授权决策；禁止在 service/前端增加平行控制源：

1. 平台/组织管理员 bypass（及系统管理员角色码合并）
2. 功能 RBAC（manifest 权限码）
3. 引用 display（manifest `reference_resources` + `module_references`）
4. 数据范围 `DataScopeService`
5. 字段脱敏 `PermissionPolicyService`
6. 可选 ABAC `AccessPolicy`

业务状态机、外协数据范围附加条件、「我的单据」筛选 **不得** 替代上述 RBAC 或 DataScope。
