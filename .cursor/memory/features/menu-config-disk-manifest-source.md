---
title: 菜单同步只认后端磁盘 manifest
slug: menu-config-disk-manifest-source
status: delivered
domain: feature
when: 财务管理平铺、库内 menu_config 比 manifest 旧、sync 后结构仍不对
keywords:
  - menu_config
  - bind_menu_config_to_disk_manifest
  - finance-receipts
  - kuaicaiwu
  - sync-manifest
standard: 写 core_menus 前用 ApplicationService.bind_menu_config_to_disk_manifest；真源是后端 src/apps/{code}/manifest.json
---

# 菜单同步只认后端磁盘 manifest

## 目标

侧栏父子关系与后端 manifest 分组一致；禁止用过期的 `core_applications.menu_config` jsonb 当同步真源。

## 何时读 / 禁止另起

- 何时读：快财务有收款管理/付款管理分组但侧栏仍平铺；或「本地有分组、生产平铺」且同库。
- 禁止：读侧改 `parent_id`；只改前端 `riveredge-frontend/.../manifest.json`；启用应用时直接拿库内旧 `menu_config` 写菜单。

## 标准入口

| 层 | 标准 |
|----|------|
| 磁盘真源 | `riveredge-backend/src/apps/{code}/manifest.json` |
| 绑定 | `ApplicationService.bind_menu_config_to_disk_manifest` |
| 写菜单 | `MenuService.sync_menus_from_application_config` 入口先 bind |
| 库缓存 | 绑定后回写 `core_applications.menu_config` |

## 踩坑

库内 kuaicaiwu `menu_config` 曾长期是平铺快照；kuaizhizao 已分组但被接管隐藏。侧栏用 kuaicaiwu 时看起来永远平。本节点无 compose 时读不到磁盘包，bind 只能保留库内快照，须在有包的节点跑同步。
