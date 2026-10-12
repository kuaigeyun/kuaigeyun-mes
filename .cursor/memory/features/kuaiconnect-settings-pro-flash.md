---
title: 系统配置连接管理锁定闪烁
slug: kuaiconnect-settings-pro-flash
status: delivered
domain: kuaiconnect
when: 系统配置连接管理闪锁定、已启用快连接仍短暂锁、未开通应锁定
keywords:
  - kuaiconnectReady
  - 连接管理
  - menu.group.data-center
  - systemSettingsPanel
  - isKuaiconnectReady
standard: BasicLayout 用布局已拉的 installedApps 判定；未就绪始终锁定；已就绪不闪锁；组标题 PRO 常显
---

# 系统配置连接管理锁定闪烁

## 目标

- 未开通/未授权快连接：连接管理四入口**始终**显示锁定
- 已开通且授权通过：打开系统配置**不要**短暂闪锁定
- 组标题 PRO 徽标保持常显

## 何时读 / 禁止另起

- 何时读：改系统设置浮层数据中心/连接管理门禁、锁定态
- 禁止：浮层挂载后再请求一遍已安装应用来判定就绪（会导致已开通闪锁）
- 禁止：为避免闪锁而在「列表未返回」时先解锁（未开通会短暂可点）
- 禁止：为修锁定闪烁而去掉连接管理组标题的 PRO 徽标

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `BasicLayout` + `isKuaiconnectReady(installedApps)`（布局壳查询，非浮层 gated） |
| 判定 | `utils/kuaiconnectAccess.ts` |
| 锁定 | `!kuaiconnectReady`（未安装/未启用/`can_access===false` 均锁） |
| PRO | `group.showProBadge` 常显 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 浮层门禁 | `riveredge-frontend/src/layouts/BasicLayout.tsx` |
| 就绪判定 | `riveredge-frontend/src/utils/kuaiconnectAccess.ts` |
| 锁定文案 | `riveredge-frontend/src/layouts/basicLayout/KuaiconnectLockedPopoverContent.tsx` |

## 踩坑

- 曾用 `enabled: systemSettingsPanelMounted` 的全量列表：打开浮层前 `data` 为空 → 已开通也先 `!ready` → 闪锁定
- 曾加 `appsLoaded &&`：列表未返回时先不锁 → 未开通短暂可进，违反「无权限要锁定」
- 误把「闪锁定」当成「闪 PRO」而去掉组标题 PRO；用户要求 PRO 保留
