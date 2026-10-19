---
title: 应用启用/禁用性能（增量权限同步）
slug: app-enable-disable-perf
status: delivered
domain: core-platform
when: 应用中心开关慢、enable_application、ensure_permissions force、行业包授权
keywords:
  - ensure_app_permissions
  - ensure_permissions
  - enable_application
  - grant_module_permissions_to_pack_roles
  - sync_menus_from_application_config
standard: 开关应用走 ensure_app_permissions；全量治理才 force ensure_permissions
---

# 应用启用/禁用性能

## 目标

应用中心启用/禁用不再每次全量 `PermissionSyncService.ensure_permissions(force=True)`。

## 何时读 / 禁止另起

- 何时读：改应用生命周期、菜单同步后写权限、行业包授权
- 禁止：在 enable/disable / 单应用菜单同步路径再加 `force=True` 全量 sync

## 标准入口

| 层 | 标准 |
|----|------|
| BE 增量 | `PermissionSyncService.ensure_app_permissions(tenant_id, app_code)` |
| BE 定义 | `PermissionRegistryService.collect_definitions_for_app(app_code)` |
| BE 启用 | `ApplicationService.enable_application`：已有菜单只翻转 `is_active` |
| BE 行业 | `grant_module_permissions_to_pack_roles` / `rebuild_pack_menus` 用增量 |
| FE | 应用中心 Switch：loading + 乐观 `activeOverrides` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 增量 sync | `riveredge-backend/src/core/services/authorization/permission_sync_service.py` |
| 单应用定义 | `riveredge-backend/src/core/services/authorization/permission_registry_service.py` |
| 启用 | `riveredge-backend/src/core/services/application/application_service.py` |
| 菜单同步 | `riveredge-backend/src/core/services/system/menu_service.py` |
| 行业包 | `riveredge-backend/src/core/services/application/industry_pack_menu_service.py` |
| FE | `riveredge-frontend/src/pages/system/applications/list/index.tsx` |

## 踩坑

- 全量 sync 含 advisory lock、重复行 merge、全表 scan、废弃/清理，开关一次可卡数秒到数十秒
- 行业模块启用曾 **重建菜单 + 授权各 force 一次**，双倍全量
- 结构变更仍走「同步清单/菜单」；开关热路径不代替 manifest sync
