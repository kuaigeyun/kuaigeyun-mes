---
title: 定制研发电子/结构菜单
slug: funide-oa-rd-electronics-structure-menu
status: delivered
domain: frontend
when: 改 funide-oa 研发电子菜单、结构 2D/3D/模具交付物入口、试验委托 general
keywords:
  - funide-oa
  - rdElectronics
  - rd-deliverables
  - types=
  - trialLabRequests
  - business_type
standard: manifest funide_oa + rd-deliverables types= + lab-requests business_type query
---

# 定制研发电子/结构菜单

## 目标

客户菜单：研发电子/结构下平铺 2D图、3D图、模具图及DFM（不再套「工程图纸」分组）；试验委托（L50 general）。

## 何时读 / 禁止另起

- 何时读：改 funide-oa `dept.rdElectronics` 子菜单或交付物/实验委托入口 query
- 禁止：为结构 2D/3D 再开主数据 engineering_drawings；禁止试验委托新表；禁止再加回无 path 的「工程图纸」中间分组

## 标准入口

| 层 | 标准 |
|----|------|
| 菜单真源 | `kuaigeyun-custom/backend/apps/funide_oa/manifest.json`（组装到 `riveredge-backend/src/apps/funide_oa/manifest.json`） |
| 2D/3D/模具 | `/apps/funide-oa/rd-deliverables?types=...`，直接挂在 `dept.rdElectronics` 下 |
| 试验委托 | `/apps/funide-oa/lab-requests?entry=rd-structure&business_type=general` |
| CAD 文控 | 仍在文控资料 → 工程图纸（L33），不在本组 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 交付物 types | `kuaiplm/utils/rdDeliverableDepartmentPresets.ts` |
| 定制交付物页 | `funide-oa/pages/kuaiplm/rd-deliverables/index.tsx` |
| 实验委托页 | `funide-oa/pages/kuaiplm/lab-requests/index.tsx` |

## 踩坑

- 改 manifest 后须单应用 sync-manifest（funide-oa），且 version 必须比库里已同步版本更高，否则菜单版本门禁会拒绝同号覆盖
- 「工程图纸」分组已解除；文控资料里的工程图纸入口不要动
- 实验部门菜单仍用 `app.funide-oa.menu.r02.labRequests`（实验委托）
