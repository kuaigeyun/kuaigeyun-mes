---
title: 销售订单详情接口并行取数
slug: sales-order-detail-api-perf
status: delivered
domain: kuaizhizao-sales
when: 销售订单点详情很慢、get_sales_order_by_id 数秒、详情 API 性能
keywords:
  - get_sales_order_by_id
  - 销售订单详情慢
  - sales_order_downstream_by_ids
  - asyncio.gather
  - get_document_milestones
standard: 详情独立查询 asyncio.gather；下游/改号用 sales_order_downstream_by_ids；执行子阶段用业务事实勿拉追溯链里程碑
---

# 销售订单详情接口并行取数

## 目标

点开销售订单详情时后端尽快返回，避免串行十余次 DB/追溯把首包拖到数秒。

## 何时读 / 禁止另起

- 何时读：详情慢、`get_sales_order_by_id` 耗时、怀疑 milestones/downstream 重复 trace
- 禁止：详情再调 `get_document_milestones` / `sales_order_has_downstream_documents`（内部再 `trace_document_chain`）；禁止 `resolve_sales_order_code_editable` 再查一遍下游

## 标准入口

| 层 | 标准 |
|----|------|
| BE | `SalesOrderService.get_sales_order_by_id`：明细加载后 `asyncio.gather` 并行账款/可发货/下推/配置/发货通知存在性等 |
| 下游门禁 | `sales_order_downstream_by_ids`（与列表 capabilities 同款）→ 同步 `resolve_document_code_editable` |
| 生命周期 | `get_sales_order_lifecycle(..., has_shipment_notice=)`：执行中子阶段按 `pushed` / 明细 `work_order_id` / 发货通知 / 交货进度 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 详情服务 | `riveredge-backend/src/apps/kuaizhizao/services/sales_order_service.py` |
| 生命周期 | `riveredge-backend/src/apps/kuaizhizao/services/document_lifecycle_service.py` |
| 下游批量 | `riveredge-backend/src/apps/kuaizhizao/services/sales_order_code_sync.py` |

## 踩坑

- 旧路径对同一订单串行：`get_document_milestones` + `has_downstream` + `code_editable`（再查下游）≈ 三次 `trace_document_chain`，单独即可占数秒
- FE 时间轴不读详情里的 document milestones；勿为展示再拉追溯链

## 关联

- `features/sales-order-form-material-preload.md`（新建进页）
- 更新日志 `sales-order-detail-api-perf-r01`
