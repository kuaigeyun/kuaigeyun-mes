---
title: 采购申请 Mode A 钉住草稿/驳回筛空
slug: purchase-requisition-lifecycle-pin-mode-a
keywords:
  - purchase-requisition
  - lifecycle_stage
  - Mode A
  - 暂无数据
  - 菜单角标
when: 采购申请有权限但列表空、角标有数、钉住草稿已驳回无单
---

# 采购申请 Mode A 钉住草稿/驳回筛空

## 何时读

采购申请功能权限已开、菜单角标有数、列表「暂无数据」；或钉住「草稿」「已驳回」后列表恒空。

## 根因

Mode A：草稿/待审/驳回的 `current_stage_name` 为「—」（审核见 audit 列）。旧筛选用阶段名与钉住标签比对 → 永不命中。

功能权限 / 数据权限不是本症状主因：列表当前未走 `DataScopeService.apply`；角标对采购申请是租户 raw count。

## 标准入口

| 用途 | 路径 |
|------|------|
| 筛选真源 | `match_purchase_requisition_lifecycle_filter`（`document_lifecycle_service.py`） |
| 列表调用 | `PurchaseRequisitionService._filter_requisitions_by_lifecycle_stage` |
| 回归 | `tests/apps/kuaizhizao/services/test_mode_a_lifecycle.py` |

## 禁止

- 再用 `current_stage_name == "草稿"` 做 Mode A 列表筛选
- 为「这一页好看」在读侧补 status 映射旁路

## 同角色一人有数一人空白

1. UniTable「重置」曾把 `searchParamsRef` 写成 `undefined`，回退 ProForm 残留筛选 → 重置须写 `{}`。
2. **更致命（浏览器实测）**：`GET .../purchase-requisitions` 返回 **422**，文案「流程发起人须在提交时选择「是否总经理特批」分支」；前端无 toast 时表现成「暂无数据」。角标仍是租户 raw count。列表 audit enrich / viewer 门控失败不得拖垮整页（见 `enrich_items`、`batch_flow_viewer_actions_for_entities`、`list_requisitions` 容错）。

与 DataScope / 功能权限无关。
