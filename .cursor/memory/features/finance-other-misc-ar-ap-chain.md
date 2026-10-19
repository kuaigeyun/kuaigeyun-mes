---
title: 其他费用收支 应收应付 收付款链
keywords:
  - other_income
  - other_expense
  - misc_voucher_finance_bridge
  - RECEIVABLE_SOURCE_OTHER_INCOME
  - PAYABLE_SOURCE_OTHER_EXPENSE
  - MiscVoucherPostingService
---

## 何时读

改其他费用收入/支出审核、确认过账、反审、详情关联单号或下推收款/付款时。

## 唯一写路径

| 阶段 | 真源 | 禁止 |
|---|---|---|
| source_type | `finance_source_types.RECEIVABLE_SOURCE_OTHER_INCOME` / `PAYABLE_SOURCE_OTHER_EXPENSE` | 页面 alias 映射 |
| 审核挂账 | `MiscVoucherFinanceBridge.ensure_*_on_*_approved`（`other_income_service` / `other_expense_service`） | 读侧 enrich 补 AR/AP |
| 确认资金 | `MiscVoucherPostingService` → `create_concurrent_receipt_for_receivable` / `create_concurrent_payment_for_payable` | `BankAccountService.sync_from_confirmed_voucher(other_income\|other_expense)` |
| 反审 | `assert_*_revokable` + `void_*_for_*_revoke` 删 AR/AP | 保留已核销应收应付仍回草稿 |

## 前端

- 列表/详情：`MiscVoucherListPage` + `finance_links` 字段；`openLinkedDocumentDetail('receivable'|'receipt'|'payable'|'payment')`
- 行操作：`push_receipt` / `push_payment` capabilities，调用 confirm API

## 踩坑

- `DocumentRelation` 无 `deleted_at`，查询/幂等判断禁止 `deleted_at__isnull`（见 `document_relation_new_service`）
- 须选客户/供应商才能审核通过挂账；无往来不能 confirm
- 确认后反确认走收款/付款 `apply_confirmed_voucher_unpost`，misc 状态回 Approved
