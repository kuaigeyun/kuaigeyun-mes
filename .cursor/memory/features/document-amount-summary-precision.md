---
title: 单据合计金额精度（禁止先压单价为分）
keywords:
  - DocumentAmountSummary
  - documentLineAmounts
  - amount_decimal_places
  - 合计取舍
  - 采购订单合计
  - calcDocumentLineAmounts
when: 采购/销售/报价等表单合计与行总价不一致、单价多位小数被合计成 0.20
---

# 单据合计金额精度

## 何时读

新建/编辑采购订单、销售订单等带 `DocumentAmountSummary` 的表单时，合计与明细「总价」对不上（如单价 0.195、行总价 0.1950、合计却 0.2000）。

## 标准入口

| 层 | 路径 |
|----|------|
| 汇总 UI | `riveredge-frontend/src/apps/kuaizhizao/components/document-amount-summary/DocumentAmountSummary.tsx` |
| 价税/合计真源 | `riveredge-frontend/src/apps/kuaizhizao/utils/documentLineAmounts.ts`（`calcDocumentLineAmounts` / `computePurchaseDocumentTotals`） |
| 金额小数位 | `common.amount_decimal_places` → `getCachedNumericPrecisionPlaces('amount')` |

## 契约

1. **先** `数量 × 单价`，**再**按金额小数位半入舍入。
2. **禁止**先把单价 `Math.round(price * 100) / 100` 再乘数量（会把 0.195 变成 0.20）。
3. 展示走 `formatCurrencyAmount` / `formatDocumentMoneyYuan`，与配置位数一致。

## 踩坑

- 行总价若用裸 `qty * price`、合计却走旧「分币」路径，同页就会自相矛盾。
- 人民币大写仍只到「角/分」；位数 >2 时大写按传统截到分，不影响阿拉伯数字合计。

## 禁止另起

不要在各单据页再写一套 `toFixed(2)` 合计；统一改 `documentLineAmounts`。
