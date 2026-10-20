---
title: MRP 下推工单 BOM 版本快照
keywords: mrp, work_order, bom_version, material_bom_versions, mrp_bom_snapshot
---

## 何时读

需求计算与工单 BOM/齐套版本不一致、或改 MRP 下推/工单展开逻辑时。

## 标准入口

- 快照解析：`apps/kuaizhizao/utils/mrp_bom_snapshot.py`
- 下推写入：`DemandComputationService._create_work_order_from_item` 或 `SalesOrderService.push_sales_order_to_work_order` → `WorkOrderCreate` + `create_work_order`
- 销售直推 UI：`DirectPushBomVersionFields`（销售订单/工单列表取单直推预览）
- 展开消费：`bom_expand_kwargs_from_work_order(wo)` → `calculate_material_requirements_from_bom`

## 字段

| 工单字段 | 含义 |
|---------|------|
| `bom_version` | `computation_params.bom_version` 全局参数 |
| `material_bom_versions` | 按物料版本 JSON 快照 |
| `bom_id` / `product_bom_version` | 本工单成品解析后的 BOM 头与版本（展示） |

## 禁止

- 工单展开仍裸调 `get_bom_by_material_id` 取最新而忽略工单快照（MRP 下推场景）

## 迁移

`903_20261020120000_work_order_mrp_bom_snapshot.py`
