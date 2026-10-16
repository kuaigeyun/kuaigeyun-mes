---
title: 付款单来源单据与打印导出
keywords: finance_payment, 付款单, linked_source_documents, FINANCE_PAYMENT_PRINT, print, export
---

## 标准入口

- 详情 enrichment：`finance_voucher_enrichment.enrich_voucher_detail` → `linked_source_documents`（`payable` / `payment_application`，读 DocumentRelation pull）
- 详情 UI：`FinanceVoucherRelationLinks` + `openSourceDocument`（应付进 `/payables/{id}`，付款申请带 keyword 跳转列表）
- 打印：`GET /apps/kuaicaiwu/payments/{id}/print` → `DocumentPrintService` document_type=`finance_payment`
- 预置：`FINANCE_PAYMENT_PRINT`（`PRINT_STYLE_A4_PLAIN` 黑白）；金额走 `format_business_amount`
- 列表：`payments/index.tsx` `UniCapabilityBatchButton` + `showExportButton` + `useKuaizhizaoPrintModal`

## 禁止

- 详情里用 `message.info` / 只 navigate 列表冒充来源详情
- 打印模板用品牌色；金额裸 `str(Decimal)`

## 存量租户

跑 `/apps/kuaizhizao/print/load-presets` 或打印模板「加载预设」创建 `FINANCE_PAYMENT_PRINT_*`
