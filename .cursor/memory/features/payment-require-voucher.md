---
title: 付款申请要求上传付款凭证
keywords:
  - require_payment_voucher
  - requirePaymentVoucher
  - 付款凭证
  - 付款申请
  - 付款单
  - DocumentAttachmentsField
created: 2026-10-15
---

# 付款申请「是否需要上传付款凭证」

## 何时读

改付款申请新建/编辑、付款单确认过账附件门禁、下推付款单带标志时。

## 标准入口

| 层 | 路径 |
|---|---|
| 申请表字段 | `PaymentApplication.require_payment_voucher` |
| 付款单字段 | `Payment.require_payment_voucher`（下推/取单自申请复制） |
| 过账校验 | `FinanceVoucherPostingService.post_payment` |
| FE 申请开关 | `payment-applications` FormModal：备注后 `ProFormSwitch` |
| FE 付款单门禁 | `payments`：编辑附件 `required`；确认前校验 |

## 契约

- 申请勾选 → 下推/创建付款单带 `require_payment_voucher=true`
- 确认过账时无附件 → 报错；未勾选 → 附件可选
- 迁移：`886_20261015082000_payment_require_voucher_flag`

## 禁止

- 在读侧猜是否必传；不在前端旁路绕过确认校验
