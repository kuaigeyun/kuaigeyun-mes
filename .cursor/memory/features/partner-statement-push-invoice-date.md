---
title: 往来对账单下推与开票日期
slug: partner-statement-push-invoice-date
status: delivered
domain: finance-ui
when: 对账单下推付款申请/采购收票、开票日期列、财务管理 vs 轻财务托管
keywords:
  - partner-statement
  - 往来对账
  - 下推
  - 付款申请
  - 采购收票
  - invoice_date
  - 开票日期
standard: 页在 kuaizhizao/finance-management；启用轻财务后菜单托管 kuaicaiwu；下推复用对账请款与合并收票
---

# 往来对账单下推与开票日期

## 目标

供应商对账单详情：已确认/已发送后可「下推」生成付款申请单、采购收票；明细展示关联发票开票日期。

## 何时读 / 禁止另起

- 何时读：对账单功能增强、分不清财务管理挂在快制造还是轻财务
- 禁止：在 `apps/kuaicaiwu` 前端再复制一套对账单页；下推另写第二套请款/收票 API

## 标准入口

| 层 | 标准 |
|----|------|
| 页面真源 | `kuaizhizao/pages/finance-management/partner-statements/`（快制造财务管理） |
| 菜单托管 | 启用轻财务后侧栏走 kuaicaiwu 接管；结构仍认 kuaizhizao manifest |
| 下推付款申请 | `pullPaymentApplicationFromReconciliation`（与业财对账同路径） |
| 下推采购收票 | `MergeFinanceDocsModal` `merge_purchase_invoice` + `previewPullFromPayable` |
| 开票日期 | Pro `PartnerStatementService.enrich_lines_invoice_dates`（应付→PurchaseInvoice，应收→Invoice OUT） |
| 列 | `usePartnerStatementLineColumns`：摘要后、单据金额前 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 详情 | `riveredge-frontend/src/apps/kuaizhizao/pages/finance-management/partner-statements/detail.tsx` |
| 列 | `.../utils/partnerStatementLineColumns.tsx` |
| BE（Pro） | `kuaigeyun-pro/backend/apps/kuaicaiwu/services/partner_statement_service.py` |

## 踩坑

- 主仓 `riveredge-backend/src/apps/kuaicaiwu` 为组装目录（gitignore）；后端改动须写 Pro 真源再 compose/同步
- 仅供应商 + Confirmed/Sent 显示下推；应付主行（非子级付款行）参与金额

## 相关

- `features/menu-takeover-single-source.md`
- `features/payment-application-procurement.md`
- `features/app-pro-migration-compose.md`
