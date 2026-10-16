---
title: 采购付款申请单
keywords: payment-application, payment_application, 付款申请, PayableOpenAmountService, PAYMENT_APPLICATION_CODE
---

## 标准入口

- 模型：`riveredge-backend/src/apps/kuaizhizao/models/payment_application.py`
- API：`riveredge-backend/src/apps/kuaizhizao/api/payment_applications/payment_applications.py`
- 可请款额度：`PayableOpenAmountService`（应付 remaining − 付款 unsettled − 已批准申请占用）
- 下推付款：`PaymentApplicationPushService`（银行转账/现金须带 `bank_account_id`）；PC 详情「下推付款单」弹窗选付款方式+出账账户+付款日期后再 `POST …/push-payment`
- 付款单取单：`payment.pull_from_payment_application`（`/apps/kuaicaiwu/payments/pull-candidates/payment-applications`）
- PC 列表：`riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/payment-applications/index.tsx`
- 组织参数：`parameters.finance.require_payment_application` 禁用订单直达预付付款单
- 编码规则：`PAYMENT_APPLICATION_CODE` / `page_code` `kuaizhizao-payment-application` / 字段 `application_code`；迁移 `864_20261013140000_seed_payment_application_code_rule`
- 明细表须含 `BaseModel` 审计列：迁移 `865_20261013150000_payment_application_line_audit_columns`（862 初版行表漏列）
- 表单栏位：`payment_reason` / `payment_method` / `invoice_status` / `payment_terms` + 收款账户三字段；迁移 `889_20261016090000_payment_application_form_fields`
- 附件：头表 `attachments` JSON + FE `DocumentAttachmentsField`（`category=payment_application_attachments`）
- 明细来源：行上 `source_type`/`source_id`/`source_code`（采购订单/入库/其他费用支出/对账/应付）；编辑保存须保留，禁止一律改写为 `payable`
- 审核：`manifest.audit` `payment_application` + `uni_audit_handlers._dispatch_payment_application`；列表/详情 `enrich_record(..., audit_enabled=True)`，前端 `UniWorkflowActions` + `entityType=payment_application`（不走业务配置开关/绑定流程）

## 扩展点

- 来源：PO 预付、入库货款（绑定应付）、往来对账应付行、其他费用支出（审核后 `payable_id`）、手工拉应付
- 采购订单 capabilities：`push_payment_application`
- 采购入库 Hub capabilities：`push_payment_application`（`PaymentApplicationPullService.push_payment_application_open_by_receipt_ids` + `warehouse_inbound_hub`）
- 列表新建旁下拉（`usePaymentApplicationPullMenus` + UniPullCreateToolbar）：
  - `payment_application.pull_from_payable` → 选供应商 + `GET /payment-applications/pull/payables`
  - `…pull_from_purchase_order` → `preview` + `POST …/pull-from-purchase-order`
  - `…pull_from_purchase_receipt` → `POST …/pull-from-purchase-receipt`
  - `…pull_from_partner_statement` → 对账单明细应付行 + `POST …/pull-from-reconciliation`
  - `…pull_from_other_expense` → 费用详情 `payable_id` + `createPaymentApplication`（`sourceType=other_expense`）
- 详情：`linked_payments`（DocumentRelation payment_application→payment）；行 `sourceType` 可点关联单
- 打印/导出：列表 `showExportButton` + `UniCapabilityBatchButton`（print）+ `useKuaizhizaoPrintModal`；API `GET …/payment-applications/{id}/print`；预置 `PAYMENT_APPLICATION_PRINT`（`PRINT_STYLE_A4_PLAIN` 黑白，非可视化 designer）；`DocumentPrintService` document_type=`payment_application`；存量租户需跑 `/apps/kuaizhizao/print/load-presets` 或打印模板管理「加载预设」
- 打印金额：`format_business_amount` + `get_amount_decimal_places`（配置中心金额小数位）；禁止裸 `str(Decimal)` 带出库表最高位

## 禁止

- 为付款申请另起第二套 pull API / 平行选单组件；只扩 `documentActionRegistry` 动作键与 `usePaymentApplicationPullMenus`
- 付款申请打印模板用品牌色 / 色底 / 左侧装饰条；须走 `PRINT_STYLE_A4_PLAIN`
