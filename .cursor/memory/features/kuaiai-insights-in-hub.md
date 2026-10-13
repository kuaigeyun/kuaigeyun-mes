---
title: KU-AI 调用分析并入能力矩阵
slug: kuaiai-insights-in-hub
status: delivered
domain: frontend
when: 改 KU-AI 能力矩阵/调用分析菜单或 hub 页布局
keywords:
  - kuaiai
  - 能力矩阵
  - 调用分析
  - insights
  - hub
standard: 调用分析内容在 hub 页；侧栏/路由无独立 insights；pages/insights 已删
---

# KU-AI 调用分析并入能力矩阵

## 何时读 / 禁止另起

- 何时读：要加回「调用分析」菜单，或拆分 hub 统计图表时
- 禁止：在智能治理下再挂独立 insights 菜单；留假路由重定向

## 标准入口

| 层 | 标准 |
|----|------|
| FE 页 | `kuaigeyun-pro/frontend/apps/kuaiai/pages/hub/index.tsx`（组装态 `riveredge-frontend/src/apps/kuaiai/`） |
| 路由 | `index.tsx` 无 insights；页面目录已删 |
| 菜单 | 前后端 `manifest.json` 的 `menu_config`（无 insights 项） |

## 关键文件

| 角色 | 路径 |
|------|------|
| Pro FE | `kuaigeyun-pro/frontend/apps/kuaiai/` |
| Pro BE | `kuaigeyun-pro/backend/apps/kuaiai/manifest.json` |
| 组装 | `riveredge-*/src/apps/kuaiai/`（改完须与 Pro 一致） |

## 加载性能（能力矩阵）

| 项 | 真源 |
|----|------|
| 目录 | `CatalogService.list_capabilities` 只用 `get_capability_call_counts`，禁止再调 `get_overview` |
| 概览 | `GET /core/ai/stats/overview` 默认 `include_pulse=false`；审计用聚合，不整表 `.all()` |
| Pulse 指标 | `GET /core/ai/stats/pulse-count`（60s 进程缓存）；FE hub 首屏后再补 |
| 图表 | `pages/hub/HubInsightCharts.tsx` lazy，勿在 hub 顶层 import `@ant-design/charts` |

## 踩坑

- 主仓与 Pro 可能是 copy 而非 junction：改组装态后必须 `cp`/对齐 Pro 真源
- 去掉菜单后须 `sync-manifest`（或等价 `update_application` + `sync_menus`），否则 `core_menus` 仍留旧项
- hub 若再 `Promise.all` 把 pulse 绑进首屏，会重新变慢
