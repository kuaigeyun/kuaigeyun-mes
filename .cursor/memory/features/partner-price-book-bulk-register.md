---
title: 价格本批量登记
keywords:
  - 价格本
  - partner-price-book
  - bulk
  - 批量登记
  - customer-price-books
  - supplier-price-books
date: 2026-10-17
---

# 客户/供应商价格本批量登记

## 何时读

改价格本批量登记、冲突跳过/覆盖、或 `POST .../bulk` 时读。

## 标准入口

- 列表：[`partner-price-books/index.tsx`](riveredge-frontend/src/apps/master-data/pages/supply-chain/partner-price-books/index.tsx) 工具栏「批量登记」
- 弹窗：[`PartnerPriceBookBatchRegisterModal.tsx`](riveredge-frontend/src/apps/master-data/pages/supply-chain/partner-price-books/PartnerPriceBookBatchRegisterModal.tsx)
- API：`POST /apps/master-data/supply-chain/{customer|supplier}-price-books/bulk`
- Service：`PartnerPriceBookService.bulk_register`

## 行为

- 伙伴多选 × 明细物料 = 笛卡尔 create；不含 `variantPrices`。
- `conflictPolicy` 空且有重叠 → 409 + `error.details.conflicts`，零写入。
- `skip` / `overwrite`：覆盖只改标准价等头字段，不动 `variant_prices`。

## 禁止

- 在批量登记维护 SKU 价（走单条新建）。
- 读侧补冲突数据或静默跳过未告知用户。
