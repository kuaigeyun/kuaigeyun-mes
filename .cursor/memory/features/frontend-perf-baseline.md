---
title: 前端性能基线与优化主线
slug: frontend-perf-baseline
status: active
domain: frontend-perf
when: 前端慢、进页卡、详情慢、要做性能优化、Top5 菜单基线
keywords:
  - 前端性能
  - Network 基线
  - useDeferAfterPaint
  - 详情懒 Tab
  - loadMaterialFormReferenceList
standard: 先量 Network；详情/Tab 走 DetailDrawerTemplate 懒挂载；列表统计延后；禁止进页全量物料预拉
---

# 前端性能基线与优化主线

## 目标

Top5 高频菜单可复测、有预算；体感慢优先查 API 墙钟，再查进页策略与 chunk。

## 标准入口

| 项 | 真源 |
|----|------|
| 基线表 | `riveredge-frontend/scripts/perf_menu_baseline.md` |
| 统计延后 | `useDeferAfterPaint` |
| 详情壳 | `DetailDrawerTemplate` 懒 Tab |
| 物料预拉 | 仅导入/选料按需；见 `sales-order-form-material-preload` |

## Top5 path

1. sales-orders  
2. work-orders  
3. purchase-orders  
4. sales outbound  
5. quotations  

## 交付状态（2026-10-13）

| 项 | 状态 |
|----|------|
| Top5 Network 基线表 | `scripts/perf_menu_baseline.md` |
| SO/WO/PO 详情 lifecycle 业务事实 + gather | 后端已改；抽屉走 `DetailDrawerTemplate` 懒 Tab |
| 报价/销售合同表单禁进页物料预拉 | 对齐 SO：选料 merge / 导入按需 |
| 工单/采购列表 statistics | `useDeferAfterPaint` 后再请求 |
| Chunk | `vite.config.ts` manualChunks 已拆 univer/libredwg/echarts/xlsx/pdf；Top3 列表页已 lazy 导入/图表；复测：`ANALYZE=1 npm run build:analyze` → `dist/stats.html` |

## Chunk 审计要点

- 禁止列表首屏静态拉起 `@univerjs` / `@mlightcad` / `echarts` / `xlsx`
- 全链路图勿进列表 chunk（靠 DetailDrawer 懒 Tab + DocumentTracking 懒加载）
- lodash 必须归 `vendor`，勿进 CAD chunk（见 vite 注释）

## 关联

- `sales-order-detail-api-perf.md`
- `document-trace-attach-perf.md`
- `sales-order-form-material-preload.md`
