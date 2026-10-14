---
title: 采购付款申请单
keywords: payment-application, payment_application, 付款申请, PayableOpenAmountService, PAYMENT_APPLICATION_CODE
---

## 标准入口

- 模型：`riveredge-backend/src/apps/kuaizhizao/models/payment_application.py`
- API：`riveredge-backend/src/apps/kuaizhizao/api/payment_applications/payment_applications.py`
- 可请款额度：`PayableOpenAmountService`（应付 remaining − 付款 unsettled − 已批准申请占用）
- 下推付款：`PaymentApplicationPushService`；付款单取单：`payment.pull_from_payment_application`（`/apps/kuaicaiwu/payments/pull-candidates/payment-applications`）
- PC 列表：`riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/payment-applications/index.tsx`
- 组织参数：`parameters.finance.require_payment_application` 禁用订单直达预付付款单
- 编码规则：`PAYMENT_APPLICATION_CODE` / `page_code` `kuaizhizao-payment-application` / 字段 `application_code`；迁移 `864_20261013140000_seed_payment_application_code_rule`
- 明细表须含 `BaseModel` 审计列：迁移 `865_20261013150000_payment_application_line_audit_columns`（862 初版行表漏列）
- 审核：`manifest.audit` `payment_application` + `uni_audit_handlers._dispatch_payment_application`；列表/详情 `enrich_record(..., audit_enabled=True)`，前端 `UniWorkflowActions` + `entityType=payment_application`（不走业务配置开关/绑定流程）

## 扩展点

- 来源：PO 预付、入库货款（绑定应付）、往来对账应付行、手工拉应付
- 采购订单 capabilities：`push_payment_application`
- 采购入库 Hub capabilities：`push_payment_application`（`PaymentApplicationPullService.push_payment_application_open_by_receipt_ids` + `warehouse_inbound_hub`）
- 列表上拉：`payment_application.pull_from_payable`（UniPullCreateToolbar + `GET /payment-applications/pull/payables`）
- 详情：`linked_payments`（DocumentRelation payment_application→payment）；行 `sourceType` 可点关联单
