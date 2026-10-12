---
title: 物料选择器走 reference-display（回显即可选料）
slug: uni-material-select-reference-display
status: delivered
domain: rbac
when: 业务单据选物料 403、仅回显仍提示加载物料列表失败、UniMaterialSelect 权限
keywords:
  - UniMaterialSelect
  - UniMaterialBatchPicker
  - master-data:material:display
  - reference-display
  - 加载物料列表失败
standard: UniMaterialSelect / BatchPicker 拉选项走 searchReferenceDisplay + resolveReferenceDisplay，鉴权 target read|display
---

# 物料选择器走 reference-display

## 目标

业务单据只需勾选物料「回显」（`master-data:material:display`），即可在下拉/批量选择器搜索选料；不必授予物料管理菜单的 `master-data:material:read`。

## 何时读 / 禁止另起

- 何时读：选料 403、回显已勾仍加载失败、改 UniMaterialSelect 取数路径
- 禁止：再直调 `materialApi.list` 做业务单据选料；禁止用 affiliate OR 把完整 materials list 挂成 display；禁止平行第二套 echo API

## 标准入口

| 层 | 标准 |
|----|------|
| FE 下拉 | `components/uni-material-select` → `searchReferenceDisplay` / `resolveReferenceDisplay`（`master-data:material`） |
| FE 批量 | `components/uni-material-batch-picker` 同路径；仓库库存口径先 balances 再 resolve |
| FE 映射 | `utils/documentFormReferenceLoad.referenceDisplayItemsToMaterials` |
| BE 鉴权 | `AccessControlService.check_reference_display`：target `:read` 或 `:display` |
| BE 取数 | `apps/master_data/reference_display/setup.py` `_MaterialDisplayProvider` |
| 对照 | `uni-warehouse-select`（已同等改造） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 选择器 | `riveredge-frontend/src/components/uni-material-select/index.tsx` |
| 批量 | `riveredge-frontend/src/components/uni-material-batch-picker/index.tsx` |
| 展示契约 | `riveredge-frontend/src/utils/referenceDisplay.ts` |
| Provider | `riveredge-backend/src/apps/master_data/reference_display/setup.py` |

## 扩展点

1. 可选传 `hostResource`（未传由 `displayContract` 按当前菜单路由推断）
2. `sourceType` / `groupId` 经 display-search extra 下发；仓库路径 resolve 后客户端再滤
3. Provider 默认仅主物料（与 mastersOnly 一致）

## 踩坑

- 旧路径 `GET /apps/master-data/materials` 只认模块 `:read`，与「回显」无关 → 统一 toast「加载物料列表失败」
- 快速新建物料仍走物料 create；无 create 时快速新建会另失败，与列表拉取解耦
- 批量选择器分组树仍调 `materialGroupApi.tree`，需分组相关权限；与物料 display 选料主路径分开
- **销售订单新建页**：禁止 `loadMaterialFormReferenceList(2000)` 进页预拉；按选中/编辑行 `resolve` 写入缓存，否则进页会串行多页 display-search 卡住很久

## 关联

- `features/permission-display-echo.md`
- `principles/reuse-existing-patterns.md`
