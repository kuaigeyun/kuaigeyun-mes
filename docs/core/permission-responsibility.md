# 权限职责分工

与 [`permission-contract.md`](./permission-contract.md) 配套。改权限相关代码前须对照本表。

## 声明与同步

| 职责 | 负责方 | 真源 |
|------|--------|------|
| 新权限码 | 功能开发 | 应用 `manifest.json` `permissions[]` |
| 入库与租户同步 | 平台 | `PermissionSyncService` / 应用中心权限同步 |
| 基线必开 | 平台 | `BASELINE_PERMISSION_CODES`（前后端镜像） |
| 矩阵展示顺序与文案 | 平台 | manifest 下标 + `permission_action_spec`（`display` 文案「回显」，矩阵可见） |
| 可回显资源登记（唯一） | 功能开发 | 应用 `manifest.json` → `reference_resources`（系统级 `CORE_REFERENCE_RESOURCES`）；前后端同改 |
| 宿主引用声明（非授权） | 功能开发 | `module_references`：目标须已登记；扫描 `module_references_unknown_target` |
| 引用取数 Provider | 功能开发 | `reference_display/setup.py`（运行实现，不替代登记） |
| 引用回显默认授予 | 平台 | 新建角色 / 同步切流回填 / 新建 `:display` 码；非 baseline，可取消 |

改 manifest 权限后：**同步 → 后端路由依赖 → 前端同一 resource 门控**。

## 后端鉴权

| 职责 | 负责方 | 真源 |
|------|--------|------|
| 标准 REST 子路径映射 | 应用 API 层 | `require_*_module_access` + `*_route_access.py` |
| 显式多码 OR（只读附属） | 平台 + 应用评审 | `affiliate_read_allowlist.py` 登记 |
| 新业务非 CRUD | 功能开发 | `require_permission_codes` |
| 审核类路由 | 功能开发 | manifest `audit` / `review_permission_codes` |

禁止在 `access.py` `_resolve_action_by_request` 为单应用堆业务特例（遗留推断除外）。

## 前端门控

| 职责 | 负责方 | 真源 |
|------|--------|------|
| 页面主资源 | 页面作者 | `usePagePermissionResource` + `useResourcePermissions` |
| 复合页关联列表 | 页面作者 | 各关联 module 的 `useResourcePermissions`；无 `canRead` 不请求 |
| 可写附属控件 | 页面作者 | 对应 `canUpdate` / `canCreate`（如设默认 BOM） |
| 宿主错误面 | 页面作者 | 仅主资源失败展示 Result；次要失败降级 |

## 复合页（物料试点样板）

| 数据 | 模块 resource | 无 read 时 |
|------|---------------|------------|
| 物料头 | `master-data:material` | 不可进详情/表单 |
| 工艺路线 | `master-data:process:route` | 不拉 list；快照回显名称 |
| 工序 | `master-data:process:operation` | 同上 |
| 供应商 | `master-data:supply-chain:supplier` | 同上 |
| 客户 | `master-data:supply-chain:customer` | 同上 |
| 仓库 | `master-data:warehouse:warehouse` | 同上 |
| 关联图纸 | `master-data:process:drawing` | 详情不展示图纸区块 |
| BOM 版本列表 | 白名单 OR | 有 material:read 可读列表；设默认须 eng-bom:update |

## 扫描与 CI

| 职责 | 负责方 | 真源 |
|------|--------|------|
| 旁路 / 混 action / 双前缀 | 平台 | `scripts/scan_permission_bypass.py` |
| manifest 码格式 | 平台 | `scripts/scan_manifest_permissions.py` |

新增扫描规则：平台维护；应用不得为单页关闭 HIGH 规则。

## 文档与 Agent

| 职责 | 负责方 |
|------|--------|
| 契约正文 | 平台（本目录） |
| Cursor 规则 | `.cursor/rules/permission-contract.mdc` |
| 改权限 checklist | `.cursor/skills/permission-governance/SKILL.md` |
