---
title: 采购订单采购员默认与金额单价互算
slug: purchase-order-buyer-amount-edit
status: delivered
domain: mes-purchase
when: 采购订单采购员为空、不含税金额不能改、金额与单价不能互算
keywords:
  - buyer_id
  - resolveDefaultPurchaseOrderBuyer
  - applyDocumentLineExclAmountEdit
  - 不含税金额
  - 采购员
  - 含税单价
standard: 采购员 getSessionCurrentUser 默认；未税金额录入走 applyDocumentLineExclAmountEdit 反算单价
---

# 采购订单采购员默认与金额单价互算

## 目标

新建采购订单采购员自动为当前登录用户；明细未税金额可录入，与单价双向换算。

## 何时读 / 禁止另起

- 何时读：采购员空白、不含税金额只读、金额改了单价不变
- 禁止：再只读 `useGlobalStore.currentUser` 当会话真源；禁止手写 qty×价公式旁路 `documentLineAmounts`

## 标准入口

| 层 | 路径 |
|----|------|
| FE 采购员默认 | `resolveDefaultPurchaseOrderBuyer` ← `getSessionCurrentUser` |
| FE 未税金额编辑 | `applyDocumentLineExclAmountEdit`（`documentLineAmounts.ts`） |
| FE 采购订单明细 | `purchase-orders/index.tsx` 不含税金额 / 未开含税时的合计列 |
| BE 创建兜底 | `PurchaseService.create`：无 buyer 时用 `created_by` |

## 踩坑

1. 会话用户常在 Query 缓存，不在 zustand；只用 store 会导致新建采购员空白。
2. 含税模式下表单 `unit_price` 是含税单价；未税金额反算须先 `calcDocumentLineAmountsFromExclTotal` 再按价类取 incl/excl ÷ 数量。
3. 明细在 `Form.Item shouldUpdate(items)` 内：`onBlur` 勿依赖 `editingExcl` state 闭包（易过期）；用 `editingExclIndexRef` + `editingExclValueRef` 判定并取值。

## 关联

- `features/document-amount-summary-precision.md`
