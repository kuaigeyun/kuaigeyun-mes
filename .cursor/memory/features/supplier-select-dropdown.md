---
title: 供应商选择走 SupplierSelectDropdown（可搜索）
slug: supplier-select-dropdown
status: delivered
domain: master-data
when: 业务单据选供应商、建议供应商无搜索、采购申请/采购订单供应商下拉
keywords:
  - SupplierSelectDropdown
  - UniDropdown
  - 建议供应商
  - showSearch
  - master-data:supply-chain:supplier
standard: SupplierSelectDropdown → UniDropdown（默认 showSearch + 拼音）+ reference-display；禁止明细表裸 Select 堆 options
---

# 供应商选择走 SupplierSelectDropdown（可搜索）

## 目标

业务单据选供应商（含采购申请「建议供应商」）与选物料体验一致：下拉可搜、可高级搜索；权限走供应商回显（display/read）。

## 何时读 / 禁止另起

- 何时读：建议供应商无搜索、要做「全站类似下拉统一可搜」
- 禁止：再写一套带 search 的裸 `Select`；禁止为单页复制客户/供应商选择器

## 标准入口

| 层 | 标准 |
|----|------|
| FE 供应商 | `apps/master-data/components/SupplierSelectDropdown.tsx` → `UniDropdown`（默认 `showSearch` + 拼音） |
| FE 物料对照 | `components/uni-material-select`（同属 reference-display 族） |
| FE 底座 | `components/uni-dropdown`：凡走 UniDropdown 的业务下拉默认可搜 |
| 取数 | `searchReferenceDisplay` / `resolveReferenceDisplay`（`master-data:supply-chain:supplier`） |
| 宿主 | 传 `hostResource`（如 `KUAIZHIZAO_DOC_HOST.purchaseRequisition`） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 供应商下拉 | `riveredge-frontend/src/apps/master-data/components/SupplierSelectDropdown.tsx` |
| 采购申请 | `riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/purchase-requisitions/index.tsx` |
| 采购订单参照 | `.../purchase-orders/index.tsx`（表头已用该组件） |
| UniDropdown | `riveredge-frontend/src/components/uni-dropdown/index.tsx` |

## 扩展点

1. 已有本地列表：传 `suppliers` + `autoLoad={false}`；否则 `autoLoad` 默认拉取
2. 选中回调：`onSupplierPick` 取完整供应商（含联系人），勿因不在本地缓存而丢引用
3. 客户侧对称组件：`CustomerSelectDropdown`（若有）同样挂 UniDropdown，勿平行发明

## 踩坑

- 采购申请明细曾用裸 `Select` + `options={name}`，供应商多时无法搜；改组件即可，不必改后端
- 「组件级优化」真源是 **UniDropdown 默认 showSearch** + 各主数据 `*SelectDropdown`；不要在 antd Select 全局改默认
- 财务等页若仍用 `options={supplierOptions}` 裸 Select，触达时迁到 `SupplierSelectDropdown`，勿批量脚本改全站

## 关联

- `features/uni-material-select-reference-display.md`
- `principles/reuse-existing-patterns.md`
