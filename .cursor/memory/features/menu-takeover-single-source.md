---
title: 菜单接管单一真源
slug: menu-takeover-single-source
status: delivered
domain: feature
when: 本地与生产侧栏不一致、财务管理缺收款管理/付款管理、菜单接管 is_active 被来回改
keywords:
  - menu_takeover
  - reconcile_takeovers_for_tenant
  - is_manifest_deployed_on_node
  - finance-receipts
  - kuaicaiwu
standard: 侧栏接管只认库内应用已启用与 MENU_TAKEOVER_RULES；导航请求禁止按本机磁盘写 core_menus
---

# 菜单接管单一真源

## 目标

同一份 `core_menus` 上，本地进程与生产进程打开侧栏得到同一棵树。

## 何时读 / 禁止另起

- 何时读：财务管理侧栏有的环境有分组、有的环境是平铺；或怀疑菜单接管在抢 `is_active`。
- 禁止：在 `get_menu_tree` 里按本机 `manifest.json` 是否存在调用 `reconcile_takeovers_for_tenant`；禁止用 manifest 指纹把侧栏缓存拆成两套；禁止再写读侧改 `parent_id` 的补齐。

## 标准入口

| 层 | 标准 |
|----|------|
| 启用 | `core_applications.is_installed` 且 `is_active`。`is_consumer_effective` 只查这一行 |
| 规则 | `core/config/menu_takeover.py` 的 `MENU_TAKEOVER_RULES` |
| 侧栏 | `MenuService._exclude_taken_over_source_menus`：consumer 在已启用列表中时，隐藏 source 路径及其子节点。不写库 |
| 写库 | 仅应用启用/停用 `sync_for_application_lifecycle`，以及菜单同步后的 `reapply_after_source_menu_sync` |
| 父级 | `core_menus.parent_id`，由 manifest 同步写入 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 读 | `riveredge-backend/src/core/services/system/menu_service.py` |
| 接管 | `riveredge-backend/src/core/services/system/menu_takeover_service.py` |
| 规则 | `riveredge-backend/src/core/config/menu_takeover.py` |

## 踩坑

导航缓存键曾带本机 manifest 指纹。生产磁盘不变时会一直命中旧树。规则变更后缓存版本为 `v9`，且不再带指纹。生产进程必须跑到这份后端，旧进程仍会在每次打开侧栏时按本机磁盘改 `is_active`。
