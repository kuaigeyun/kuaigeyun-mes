---
title: 应收应付审核一次写回
slug: finance-ar-ap-audit-writeback
status: delivered
domain: approval
when: 应付账款/应收账款/进项发票审核要点两遍、流程已通过单据仍待审
keywords:
  - payable
  - receivable
  - purchase_invoice
  - FinanceService
  - is_auto_approve
  - 审两遍
  - writeback_failure
standard: 完成回调用 PayableService/ReceivableService/PurchaseInvoiceService + is_auto_approve=True 只写单据
---

# 应收应付审核一次写回

## 根因

`_handle_approval_completion` 误 `from ... import FinanceService`（类不存在）→ 回调失败记 `writeback_failure` → 流程已 approved、单据仍待审 → 再点一次才走 `flow_completed_approved` 补齐。

## 标准入口

| 层 | 路径 |
|----|------|
| 完成回调 | `approval_instance_service._handle_payable/_receivable/_purchase_invoice` |
| 业务写回 | pro `finance_service.PayableService.approve_*(..., is_auto_approve=True)` |
| 人工审核 | 仍走 `UniAuditService.approve_with_flow_fallback` → `execute_approval` → 回调写回 |

## 禁止

- 回调再 `approve_with_flow_fallback` / `execute_approval`
- 虚构 `FinanceService` 聚合类
