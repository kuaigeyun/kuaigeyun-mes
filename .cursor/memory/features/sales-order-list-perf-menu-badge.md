---
title: 销售订单列表性能与菜单徽章（DataScope 统一）
slug: sales-order-list-perf-menu-badge
status: delivered
domain: kuaizhizao-sales
when: 销售订单列表慢、左侧菜单销售订单数字徽章不显示、menu badge salesman
keywords:
  - 销售订单列表慢
  - menu-badge-counts
  - sales_order 徽章
  - list_sales_orders asyncio.gather
  - DataScope 徽章
standard: 列表批量取数对齐详情 gather；徽章只走 badge_count(DataScope)，禁止硬过滤 salesman_id
---

# 销售订单列表性能与菜单徽章

## 何时读 / 禁止另起

- 列表进页慢、徽章为 0 但列表有待交货单
- **禁止**：再写 `_sales_order_menu_badge_query(salesman_id=…)` 或第二套徽章统计

## 标准入口

| 项 | 真源 |
|----|------|
| 列表批量取数 | `sales_order_service.list_sales_orders`：Demand/明细/账款/发货/配置等 `asyncio.gather`（与详情一致） |
| 菜单徽章 | `menu_badge_counts_service._section_sales` + `badge_count(..., RES_SALES_ORDER)` |
| 徽章 UI | `BasicLayout` `MENU_BADGE_PATH_KEY` → `sales_order`；逾期红 / pending+in_progress 蓝 |

## 踩坑

- 曾硬过滤 `salesman_id=当前用户`，与 DataScope「全部」冲突 → 管理员/有全量范围的用户徽章恒为 0
- ValuesListQuery 须先 `list()` 再 `id__in`，否则销售段异常被 `_safe_section` 吞掉导致无徽章
- 未交明细状态只认中文「待交货」「部分交货」；一次查出再拆 pending/in_progress，勿三次扫表

## 关联

- `frontend-perf-baseline.md`
- `sales-order-detail-api-perf.md`
- `menu-badge-data-scope`（更新日志）
