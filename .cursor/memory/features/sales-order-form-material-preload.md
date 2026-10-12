---
title: 销售订单表单物料按需缓存（禁进页全量预拉）
slug: sales-order-form-material-preload
status: delivered
domain: master-data-ui
when: 新建销售订单很慢、进页卡很久、loadMaterialFormReferenceList 2000
keywords:
  - 销售订单新建
  - loadMaterialFormReferenceList
  - searchReferenceDisplayAll
  - materials 预拉
  - 打开很慢
standard: 销售订单表单不预拉全量物料；选料/编辑 resolve/导入时再写入 materials 缓存
---

# 销售订单表单物料按需缓存

## 目标

点「新建销售订单」后表单尽快可填，不因预拉上千物料阻塞。

## 何时读 / 禁止另起

- 何时读：新建 SO 打开慢、进页 display-search 刷屏、怀疑物料预拉
- 禁止：在 `isFormPage` mount 时再 `loadMaterialFormReferenceList` / `searchReferenceDisplayAll(..., 2000)`

## 标准入口

| 场景 | 做法 |
|------|------|
| 下拉选料 | `UniMaterialSelect` + reference-display；`onChange` → `mergeMaterialsCache` |
| 编辑回填 | `resolveMaterialFormReference` 按行 `material_id` |
| 明细 Excel 导入 | 导入动作触发时再 `loadMaterialFormReferenceList`（按需） |
| 批量加料 | `appendOrderItemsFromMaterials` 直接 merge 已选 |

## 关键文件

`riveredge-frontend/src/apps/kuaizhizao/pages/sales-management/sales-orders/index.tsx`

## 关联

- `uni-material-select-reference-display.md`
- `permission-display-echo.md`

## 列表/详情（2026-10-12）

- 订单视图列表：`resolveSalesOrderListApiParams` 仅明细视图 `includeItems: true`；订单视图不带全量 items，减轻 `list_sales_orders` 批量计算
- 详情抽屉：先 `open` + loading，再 `getSalesOrder(id, true, false)` 与自定义字段并行；勿等数据返回才开抽屉

## 保存慢（2026-10-12）

- `update` 门禁：`_assert_sales_order_capability_for_order(..., "update")` 只跑状态/锁定，禁止每次保存拉下推/发票/采购上下文
- 明细：`SalesOrderItem.bulk_create`（与 sync 路径一致），禁止逐行 `create`
- 保存回包：`get_sales_order_by_id(..., view="options")`，勿完整 capabilities
- 需求重算事件 / upstream impact：仅 `planning_relevant`（明细/交期/金额等）时触发
