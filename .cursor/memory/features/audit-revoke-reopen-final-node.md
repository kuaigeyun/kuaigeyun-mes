---
title: 撤销审核重开终审节点
slug: audit-revoke-reopen-final-node
status: delivered
domain: approval
when: 终审撤销回到上一级、终审人没有审核按钮、撤销后应留在终审人待办可再审
keywords:
  - reopen_at_last_approval_node
  - revoke_with_flow_fallback
  - resolve_revoke_to_draft_landing_phase
  - flow_reopened
  - 终审撤销
  - 撤销审核
standard: 反审核有已通过实例时重开终审节点 pending；单据落 pending 而非草稿重提
---

# 撤销审核重开终审节点

## 目标

多级审批「撤销审核」后停在终审人待办，保留条件分支等前序决策，终审人可直接再审；不得退回上一级（如条件节点）或一律草稿重提。

## 何时读 / 禁止另起

- 何时读：终审撤销、反审核后无审核按钮、撤销回到上一级
- 禁止：再把人工审 revoke 一律写成 draft；禁止 strip 分支键后再启新实例从 start 走

## 标准入口

| 层 | 路径 |
|----|------|
| BE 重开 | `ApprovalInstanceService.reopen_at_last_approval_node` |
| BE 门面 | `UniAuditService.revoke_with_flow_fallback`（回调声明 `reopened` 时才重开） |
| BE 落点 | `resolve_revoke_to_draft_landing_phase(..., flow_reopened=)` → pending / draft |
| BE 采购申请 | `PurchaseRequisitionService.withdraw_approval` |
| BE 销售订单 | `SalesOrderService.unapprove_sales_order` |

## 踩坑

1. 旧契约「revoke 一律 draft」导致重提后条件节点再待办（尤达盛），终审人（付娇红）审核按钮置灰。
2. 未声明 `reopened` 的旧 `flow_revoke` 仍走 cancel+草稿，避免其它单据硬编码 DRAFT 时留下 orphan pending 实例。
3. 重开须**保留** `__branch_true_*`；`cancel_approval` / 撤回提交才 strip。

## 关联

- `features/audit-hub-approve-button-visible.md`（撤回重提清分支）
- `features/pc-audit-unreview-empty-pending.md`
