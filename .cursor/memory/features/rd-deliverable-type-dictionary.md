---
title: 研发交付物类型系统字典
slug: rd-deliverable-type-dictionary
status: delivered
domain: kuaiplm
when: 改交付物类型下拉、快速新增类型、部门 preset 过滤、RD_DELIVERABLE_TYPE 字典
keywords:
  - RD_DELIVERABLE_TYPE
  - rd-deliverable
  - DictionarySelect
  - deliverable_type
  - rdDeliverableTypePresentation
standard: 表单 DictionarySelect(simpleQuickCreate) + 列表 DictionaryLabel；真源 backend SYSTEM_DICTIONARIES
---

# 研发交付物类型系统字典

## 目标

研发交付物 `deliverable_type` 由租户在系统字典维护，新建时下拉可快速新增；内置 canonical 码仍驱动签核/发放等后端特判。

## 何时读 / 禁止另起

- 何时读：交付物新建类型、preset 部门视角过滤、类型列展示
- 禁止：页面再维护 `RD_DELIVERABLE_TYPE_SELECT_VALUES` 硬编码下拉；禁止第二套 quickCreate

## 标准入口

| 层 | 标准 |
|----|------|
| 字典定义 | `riveredge-backend/src/core/config/system_dictionaries.py` → `RD_DELIVERABLE_TYPE` |
| 应用归属 | `installed_feature_scope.py` → `kuaiplm` |
| 表单 | `DictionarySelect` + `simpleQuickCreate` + `hostResource`（`kuaiplm:project`） |
| preset 过滤 | `rdDeliverableTypeExcludeValuesForPreset`（exclude 非本部门 canonical；自定义项不在 canonical 内） |
| 展示 | `DictionaryLabel` + `notFoundPlaceholder` = `resolveRdDeliverableTypeLabel`（别名/system_archive） |
| 首帧种子 | `buildRdDeliverableTypeSelectOptions` 仅作字典未加载时的 locale 种子 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 字典项 | `riveredge-backend/src/core/config/system_dictionaries.py` |
| 展示/过滤 | `riveredge-frontend/src/apps/kuaiplm/utils/rdDeliverableTypePresentation.ts` |
| 列表页 | `riveredge-frontend/src/apps/kuaiplm/pages/rd-deliverables/index.tsx` |
| 项目工作台 | `riveredge-frontend/src/apps/kuaiplm/pages/rd-projects/detail.tsx` |

## 扩展点

1. 新增内置类型：改 `system_dictionaries.py` items + `RD_DELIVERABLE_TYPE_CANONICAL_CODES` + 必要时 `rdDeliverableDepartmentPresets` + 后端特判常量
2. 跑 `riveredge-frontend/scripts/generate_system_dictionary_locale.py` 更新 generated locale

## 踩坑

- 自定义类型 value 用 `simpleQuickCreate` 时与 label 相同；业务特判只认内置码
- 部门 preset 用 `excludeValues`，不要用 options 白名单（会挡掉租户自建项）
