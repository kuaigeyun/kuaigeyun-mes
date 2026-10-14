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

客户菜单：研发电子/结构；工程图纸下 2D/3D/模具图及DFM；试验委托（L50 general）。

## 何时读 / 禁止另起

- 何时读：改 funide-oa `dept.rdElectronics` 子菜单或交付物/实验委托入口 query
- 禁止：为结构 2D/3D 再开主数据 engineering_drawings；禁止试验委托新表

## 标准入口

| 层 | 标准 |
|----|------|
| 菜单 | `riveredge-backend/src/apps/funide_oa/manifest.json` |
| 2D/3D/模具 | `/apps/funide-oa/rd-deliverables?types=...` |
| 试验委托 | `/apps/funide-oa/lab-requests?entry=rd-structure&business_type=general` |
| CAD 文控 | 仍在文控资料 → 工程图纸（L33），不在本组 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 交付物 types | `kuaiplm/utils/rdDeliverableDepartmentPresets.ts` |
| 定制交付物页 | `funide-oa/pages/kuaiplm/rd-deliverables/index.tsx` |
| 实验委托页 | `funide-oa/pages/kuaiplm/lab-requests/index.tsx` |

## 踩坑

- 改 manifest 后须单应用 sync-manifest（funide-oa）
- 实验部门菜单仍用 `app.funide-oa.menu.r02.labRequests`（实验委托）
