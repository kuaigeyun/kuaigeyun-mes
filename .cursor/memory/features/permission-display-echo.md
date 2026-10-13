---
title: 权限回显 display 矩阵与鉴权
keywords:
  - display
  - 回显
  - reference-display
  - check_reference_display
  - 权限矩阵
  - module_references
  - reference_resources
updated: 2026-10-12
---

# 权限回显（display）

## 何时读

改角色矩阵文案、引用下拉 403、补单据「回显」、想取消「被别的单据引用」能力时；给预设角色默认勾物料回显时。

## 单一真源（禁止平行控制）

| 职责 | 真源 | 禁止当作真源 |
|------|------|----------------|
| 矩阵有无「回显」、注册 `:display` | 应用 `manifest.json` → `reference_resources`；系统级 `core_reference_resources.py` | `module_references`、Provider、宿主权限 |
| 引用 API 放行 | 用户具备目标 `permission_prefix:read\|display`（`check_reference_display`） | 宿主 create/update/read 隐式 |
| 宿主声明引用谁 | `module_references`（完整性扫描） | 授权放行 |
| 如何查库展示 | `reference_display/setup.py` Provider | 决定矩阵有无勾选 |
| 复合页次要 list OR | `affiliate_read_allowlist.py` | 与回显混谈 |
| 预设角色默认物料回显 | `RoleService.PRESET_DEFAULT_DISPLAY_CODES` + `ensure_preset_default_display_permissions` | 把 display 塞进 baseline；平行第二套 echo |

前后端 `reference_resources` 必须同改。`ReferenceRegistryService` 只从 `reference_resources` 收集 display 码；`module_references` 不再构建隐式放行图。

## 标准入口

- 文案：`permission_action_spec.ACTION_DISPLAY_LABELS["display"]` =「回显」
- 矩阵：`RolePermissionMatrixService._build_action_schemas`
- 鉴权：`AccessControlService.check_reference_display`
- 默认授予：`RoleService.ensure_default_display_permissions_for_role`；同步 `_ensure_default_display_role_grants`
- **预设物料回显**：`RoleService.PRESET_DEFAULT_DISPLAY_CODES`（含 `master-data:material:display`）；`_assign_preset_permissions` / `load_preset_sme`（已存在预设）/ 权限同步调用 `ensure_preset_default_display_permissions`

## 禁止

- 宿主 create/update/read 隐式放行引用
- 新增第二套 echo action
- 把 display 放进 baseline（否则矩阵不可取消）
- 只改前端 manifest 或只加 Provider 不改 `reference_resources`

## 扩展点

补单据回显：在前后端应用 manifest 的 `reference_resources` 登记（`permission_prefix` + `display_fields` + `data_scope_key`）。若要走 reference-display 取数，再补 Provider。同组对照：同一 `menu_config` 分组内已有登记、本模块没有 → 缺口候选。

预设角色还要默认勾某回显：只往 `PRESET_DEFAULT_DISPLAY_CODES` 加码，勿改 baseline。

2026-10-11 已按同组补齐一批计划/销售/采购/仓储等 key（见该次平台更新日志）。
2026-10-12 预设角色默认物料回显（`preset-role-material-display-r01`）。

## 运维

权限同步后出现「回显」勾选；新 `:display` 码默认同步授予全部角色（非 baseline，可取消）。
权限同步 / 加载预设还会对**预设角色**幂等补齐 `master-data:material:display`（不恢复非预设角色上已取消的勾选）。
同步还回填「零授权孤儿」display（权限已入库但尚无任何角色勾选）——常见于切流前就存在的 `system:data-dictionary:display` 等系统级码：取消宿主隐式放行后若未补授，业务表单字典下拉会空。稀疏勾选（仅管理员有）靠迁移 `859_*_backfill_core_system_display_grants` 一次性补齐，之后取消不再强制恢复。

**不是**「仓储全部权限勾满就等于能执行调拨」：调拨单「执行调拨」走 `:execute`，与 `:create`/`:update` 分开。矩阵缺码时后端仍按 execute 鉴权会 403；已在 manifest 补 `warehouse-management-inventory-transfer:execute`，同步时对已有 create/update 角色传播授予（同质检 execute 传播）。

## 路由动作 vs manifest（2026-10-12）

| 职责 | 真源 |
|------|------|
| 发现「路由解析 execute/submit/dispatch 但 manifest 无码」 | `riveredge-backend/scripts/scan_route_manifest_alignment.py`（已接入 `scan_permission_bypass.py`） |
| 仓储确认/执行缺码补齐 | 前后端 kuaizhizao manifest 补 `:execute`（组装/拆卸/盘点/配料/借还料/其它出入库/采销退货等）；权限同步从 create/update 传播 |
| 前端按钮 | `useResourcePermissions` + `canAction('execute')`；采销退货确认勿用 `submit` 门控 |

交付后租户须跑**权限同步**，已有录入权的角色才会自动补上执行权并在矩阵出现「执行」。

## 关联 UI

业务单据选物料：`UniMaterialSelect` / `UniMaterialBatchPicker` 须走 reference-display（见 `uni-material-select-reference-display.md`），禁止直调 materials list 要求菜单 `:read`。
