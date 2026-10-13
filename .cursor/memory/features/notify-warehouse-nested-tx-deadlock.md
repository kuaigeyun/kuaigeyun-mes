---
title: 通知仓库 Nested 事务死锁
slug: notify-warehouse-nested-tx-deadlock
status: delivered
domain: kuaizhizao-warehouse
when: 收货/发货通知「通知仓库」504、服务器暂时不可用、后端挂死
keywords:
  - notify_warehouse
  - NestedTransaction
  - reuse_or_begin_transaction
  - 通知仓库
  - 服务器暂时不可用
standard: 取号与单据关联须 reuse_or_begin；禁止外层 in_transaction 再嵌套 generate_code/create_relation
---

# 通知仓库 Nested 事务死锁

## 目标

收货通知/发货通知「通知仓库」生成采购入库草稿或销售出库时，不再因 Tortoise 嵌套事务死锁拖死 API 进程。

## 何时读 / 禁止另起

- 何时读：通知仓库 502/503/504、「服务器暂时不可用」、补货下推/售后下推同类死锁
- 禁止：用延时重试或前端吞错掩盖；禁止再建第二套事务辅助而不走 `reuse_or_begin_transaction`

## 标准入口

| 层 | 标准 |
|----|------|
| BE 事务复用 | `core.utils.db_transaction.reuse_or_begin_transaction`（`stock_posting` 再导出） |
| BE 取号 | `CodeGenerationService.generate_code` / `generate_code_batch` |
| BE 单据关联 | `DocumentRelationNewService.create_relation` |
| BE 收货通知 | `ReceiptNoticeService.notify_warehouse` → `PurchaseReceiptService.create_purchase_receipt` |
| BE 发货通知 | `ShipmentNoticeService.notify_warehouse` → `SalesDeliveryService.create_sales_delivery` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 事务真源 | `riveredge-backend/src/core/utils/db_transaction.py` |
| 取号 | `riveredge-backend/src/core/services/business/code_generation_service.py` |
| 关联 | `riveredge-backend/src/apps/kuaizhizao/services/document_relation_new_service.py` |
| 采购入库创建 | `riveredge-backend/src/apps/kuaizhizao/services/warehouse_service.py`（`create_purchase_receipt`） |
| 销售出库创建 | 同上 `create_sales_delivery` |
| IQC 自动建单 | `quality_service.create_inspection_from_purchase_receipt` |

## 扩展点

1. 任何「外层已有事务 + generate_code / create_relation」必须复用，不得裸 `in_transaction`
2. 采购入库：取号在建单事务前；DocumentRelation 在建单事务提交后（失败只打日志）

## 踩坑

- Tortoise 0.21 `NestedTransactionPooledContext._trxlock` 不可重入；二层 Nested 永久死锁 → 网关 504
- Nested `__aexit__` 遇异常会 `rollback` 外层并 `_finalized`；旧代码 try/except 吞关联错误会误毁已建入库单
- 补货建议下推、售后下推销售退货等已有同类注释，改事务时对齐同一套复用

## 相关

- `apps/kuaizhizao/services/replenishment_suggestion_service.py`（禁止外层 in_transaction 注释）
- `apps/kuaizhizao/services/after_sales_ticket_service.py`
- 平台日志 id：`notify-warehouse-nested-tx-deadlock-r01`
