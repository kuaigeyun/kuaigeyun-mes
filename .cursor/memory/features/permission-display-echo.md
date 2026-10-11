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
updated: 2026-10-11
---

# 权限回显（display）

## 何时读

改角色矩阵文案、引用下拉 403、补单据「回显」、想取消「被别的单据引用」能力时。

## 单一真源（禁止平行控制）

| 职责 | 真源 | 禁止当作真源 |
|------|------|----------------|
| 矩阵有无「回显」、注册 `:display` | 应用 `manifest.json` → `reference_resources`；系统级 `core_reference_resources.py` | `module_references`、Provider、宿主权限 |
| 引用 API 放行 | 用户具备目标 `permission_prefix:read\|display`（`check_reference_display`） | 宿主 create/update/read 隐式 |
| 宿主声明引用谁 | `module_references`（完整性扫描） | 授权放行 |
| 如何查库展示 | `reference_display/setup.py` Provider | 决定矩阵有无勾选 |
| 复合页次要 list OR | `affiliate_read_allowlist.py` | 与回显混谈 |

前后端 `reference_resources` 必须同改。`ReferenceRegistryService` 只从 `reference_resources` 收集 display 码；`module_references` 不再构建隐式放行图。

## 标准入口

- 文案：`permission_action_spec.ACTION_DISPLAY_LABELS["display"]` =「回显」
- 矩阵：`RolePermissionMatrixService._build_action_schemas`
- 鉴权：`AccessControlService.check_reference_display`
- 默认授予：`RoleService.ensure_default_display_permissions_for_role`；同步 `_ensure_default_display_role_grants`

## 禁止

- 宿主 create/update/read 隐式放行引用
- 新增第二套 echo action
- 把 display 放进 baseline（否则矩阵不可取消）
- 只改前端 manifest 或只加 Provider 不改 `reference_resources`

## 扩展点

补单据回显：在前后端应用 manifest 的 `reference_resources` 登记（`permission_prefix` + `display_fields` + `data_scope_key`）。若要走 reference-display 取数，再补 Provider。同组对照：同一 `menu_config` 分组内已有登记、本模块没有 → 缺口候选。

2026-10-11 已按同组补齐一批计划/销售/采购/仓储等 key（见该次平台更新日志）。

## 运维

权限同步后出现「回显」勾选；新 `:display` 码默认同步授予全部角色（非 baseline，可取消）。
