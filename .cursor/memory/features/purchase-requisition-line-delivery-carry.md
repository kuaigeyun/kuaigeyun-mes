---
title: 采购申请表头到货日带入行到货日
slug: purchase-requisition-line-delivery-carry
status: delivered
domain: mes-purchase
when: 采购申请要求到货日期 / 行到货日带入 / 明细日期必填；对照采购订单销售订单日期同步
keywords:
  - purchase-requisition
  - required_date
  - 行到货日
  - applyHeaderDeliveryToItemLines
  - 要求到货日期
standard: 复用采购订单/销售订单的 applyHeaderDeliveryToItemLines + lastHeaderDeliveryRef，禁止另写第二套
---

# 采购申请表头到货日带入行到货日

## 目标

采购申请表头「要求到货日期」变更时同步明细「行到货日」；空行跟随表头，已手工改过的行保留；行到货日表单必填。

## 何时读 / 禁止另起

- 何时读：改采购申请新建/编辑表单的到货日、明细日期默认值、导入/多选物料带日期
- 禁止：不要再写一套「只在保存时补日期」或页面特有的日期拷贝；对齐采购订单 `delivery_date` → 行 `required_date`、销售订单 `delivery_date` → 行 `delivery_date`

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `applyHeaderDeliveryToItemLines` + `lastHeaderDeliveryRef`（与采购订单/销售订单同构） |
| FE 表头 | `buildFutureDateShortcutFieldProps` 的 `onApply` / `fieldProps.onChange` 调带入 |
| FE 行 | `rules={[{ required: true }]}`；添加/导入/多选物料默认 `resolveHeaderRequiredDateDefault()` |
| BE | 行 `required_date` 仍可空库字段；写路径前端保证有值；下推 PO 仍走 `_resolve_requisition_item_required_date` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 采购申请页 | `riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/purchase-requisitions/index.tsx` |
| 参照（采购订单） | `.../purchase-orders/index.tsx`（`applyHeaderDeliveryToItemLines`） |
| 参照（销售订单） | `.../sales-orders/index.tsx`（同名函数，字段为 `delivery_date`） |

## 扩展点

1. 空行：`lineDate == null` → 写入表头日
2. 曾跟随表头：`lineDate.isSame(prevHeader, 'day')` → 随表头改
3. 手工改过且与上次表头不同 → 不覆盖

## 踩坑

- 编辑回填后须 `lastHeaderDeliveryRef = null` 再 `applyHeaderDeliveryToItemLines`，才能补上历史空行
- 提交 `mapItemsForApi` 行缺日期时回落表头；仍无则报错，禁止静默空提交

## 关联

- `principles/reuse-existing-patterns.md`
- 平台日志 id：`purchase-requisition-line-delivery-carry-r01`
