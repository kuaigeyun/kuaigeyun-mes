---
title: 入库确认预览仓库走回显
slug: inbound-confirm-preview-warehouse-display
status: delivered
domain: mes-warehouse
when: 确认入库「加载确认预览失败」、仓库仅勾回显、采购入库确认预览 403
keywords:
  - 加载确认预览失败
  - loadConfirmPreviewFailed
  - proceedOpenConfirmPreview
  - loadPullWarehouseReferenceOptions
  - 确认入库
standard: 确认预览选仓用 loadPullWarehouseReferenceOptions(kuaizhizao:inbound)，禁止 masterWarehouseApi.list
---

# 入库确认预览仓库走回显

## 目标

有 `inbound:execute` 的角色在仅具备仓库「回显」时也能打开确认入库预览，不因直调 warehouses list 403 整单失败。

## 何时读 / 禁止另起

- 何时读：采购/成品/生产退料确认预览加载失败、仓库下拉空或权限不足
- 禁止：确认预览再 `warehouseApi.list` / `masterWarehouseApi.list` 要求 `:read`

## 标准入口

| 层 | 标准 |
|----|------|
| FE 选仓 | `loadPullWarehouseReferenceOptions('kuaizhizao:inbound')` |
| FE 库位 | `fetchStorageLocationsForWarehouse` 失败返回 `[]`，不阻断预览 |
| FE 报错 | `getApiErrorMessage`，勿空 `catch` 只抛通用「加载确认预览失败」 |
| 确认写 | 仍需 `kuaizhizao:inbound:execute`；IQC 门禁 ensure 需 IQC create **或** inbound execute |

## 关键文件

| 角色 | 路径 |
|------|------|
| 入库 Hub | `riveredge-frontend/src/apps/kuaizhizao/pages/warehouse-management/inbound/index.tsx` |
| 回显取仓 | `riveredge-frontend/src/components/uni-pull-query/loadPullSourceReferenceOptions.ts` |

## 关联

- `features/pull-source-display-echo.md`
- 平台日志 id：`inbound-confirm-preview-warehouse-display-r01`
