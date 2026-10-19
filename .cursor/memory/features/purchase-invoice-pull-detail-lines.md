---
title: 采购收票预览源单物料明细
slug: purchase-invoice-pull-detail-lines
status: delivered
domain: finance-ui
when: 采购发票加载预览、从应付/订单/入库创建进项发票、收票弹窗要看开票对应物料
keywords:
  - purchase_invoice
  - detail_lines
  - 收票
  - 进项发票
  - pull preview
standard: 预览 API 返回 detail_lines；收票 Modal 在金额汇总下只读展示源单物料表
---

# 采购收票预览源单物料明细

## 目标

从采购订单、入库单或应付单创建进项发票时，客户能在收票弹窗看到本次开票对应的物料明细，而不只看头表金额汇总。

## 何时读 / 禁止另起

- 何时读：改采购发票 pull 预览、收票 Modal 展示、应付溯源物料行
- 禁止：前端再调订单/入库 list 拼明细；在金额汇总表里塞物料列冒充明细

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `purchase-invoices/index.tsx` 预览 Modal：`items` 金额汇总 + `detail_lines` 物料表 |
| BE | `PurchaseInvoicePullService` 预览返回 `detail_lines`（PO/入库直读；应付按 source_type 展开） |
| 类型 | `PurchaseInvoicePullPreview.detail_lines` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 列表+收票弹窗 | `riveredge-frontend/src/apps/kuaizhizao/pages/finance-management/purchase-invoices/index.tsx` |
| 预览类型 | `riveredge-frontend/src/apps/kuaizhizao/services/finance/purchase-invoice.ts` |
| 预览服务 | `riveredge-backend/src/apps/kuaicaiwu/services/purchase_invoice_pull_service.py` |

## 扩展点

1. 应付来源为入库时优先入库行；无行再回落关联采购订单行
2. 明细只读对照，不参与可开票金额录入（金额仍走单头价税）

## 过程

1. 预览三项（PO / 入库 / 应付）统一补 `detail_lines`
2. FE 在汇总表下增加「开票明细」表

## 踩坑

- Windows 下改 BE 预览后须重启后端进程，否则前端仍拿不到 `detail_lines`
- `items` 仍是头金额汇总行，勿与 `detail_lines` 混用同一 Table

## 关联

- `features/partner-statement-push-invoice-date.md`
- `principles/reuse-existing-patterns.md`
