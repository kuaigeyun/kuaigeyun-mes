---
title: 取单来源回显（不必开查看）
slug: pull-source-display-echo
status: delivered
domain: rbac
when: 取单 403、仅回显仍空列表、pull-lines 要不要开查看、UniPullQuery 来源筛选项
keywords:
  - require_read_or_display
  - loadPullSourceReferenceOptions
  - pull-lines
  - 回显取单
  - UniPullQuery
standard: BE pull-lines 用 require_read_or_display；FE 筛选项/仓库用 loadPullSourceReferenceOptions
---

# 取单来源回显（不必开查看）

## 何时读 / 禁止另起

- 何时读：下游取单候选 403、角色只勾了来源「回显」、筛选项直调 list 失败
- 禁止：再给某个单据单独堆 `:read`；禁止筛选项直调来源单据 list / `warehouses` list

## 标准入口

| 层 | 标准 |
|----|------|
| BE 候选 GET `*pull-lines*` | `Depends(require_read_or_display("app:module"))`（`core/api/deps/access.py`） |
| FE 来源 Select | `loadPullSourceReferenceOptions({ resource: PULL_SOURCE_REFERENCE.*, hostResource })` |
| FE 取单选仓 | `loadPullWarehouseReferenceOptions(hostResource)` |
| 资源键 | `PULL_SOURCE_REFERENCE`（`uni-pull-query/loadPullSourceReferenceOptions.ts`） |
| 写确认 pull | 仍走目标单据 `:create` / `:execute`，不靠来源 read |

## 关键文件

| 角色 | 路径 |
|------|------|
| BE helper | `riveredge-backend/src/core/api/deps/access.py` → `require_read_or_display` |
| FE helper | `riveredge-frontend/src/components/uni-pull-query/loadPullSourceReferenceOptions.ts` |
| 试点壳 | `InboundQuickPullModals` / `OutboundQuickPullModals` |
| Skill | `.cursor/skills/uni-pull-query/SKILL.md`（来源回显行） |

## 扩展点

1. 新 pull-lines：dependencies 用 `require_read_or_display`，勿只写 `:read`
2. 新 `filterExtra` 来源下拉：`loadPullSourceReferenceOptions`，勿 `listXxx`
3. 委外工单筛选项用 `PULL_SOURCE_REFERENCE.outsourceWorkOrder`；候选 API 同时接受 `outsource-work-order` 与 `outsource-order` 的 read\|display

## 关联

- `features/permission-display-echo.md`
- `features/uni-material-select-reference-display.md`
