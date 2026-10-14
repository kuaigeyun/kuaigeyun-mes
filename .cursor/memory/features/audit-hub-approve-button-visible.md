---
title: 审核弹窗可审人须有审核按钮
slug: audit-hub-approve-button-visible
status: delivered
domain: approval
when: 可审核人员含当前登录人但审核弹窗只有撤回/委托、没有审核驳回
keywords:
  - UniAuditModal
  - viewer_actions
  - allowed_actions
  - has_my_pending_task
  - apply_viewer_actions_to_audit_and_capabilities
standard: allowed_actions 管可见；viewer_actions/capabilities 管可执行；弹窗用 live getApprovalStatus 再裁
---

# 审核弹窗可审人须有审核按钮

## 目标

节点「可审核人员」含当前账号时，审核弹窗必须出现审核/驳回；非待办人则置灰并提示，不得整钮消失。

## 何时读 / 禁止另起

- 何时读：可审名单对但页脚无审核按钮、只有委托
- 禁止：再从 `allowed_actions` 删除 approve/reject 冒充门控；禁止弹窗用已裁过的 `canExecute` 当作 RBAC

## 标准入口

| 层 | 路径 |
|----|------|
| BE 挂 viewer | `audit_flow_viewer_gate.apply_viewer_actions_to_audit_and_capabilities` |
| BE 待办判定 | `approval_viewer_actions.build_flow_viewer_actions` |
| BE 打开弹窗补齐 | `ApprovalInstanceService.get_approval_status` → `_sync_node_approver_tasks` |
| FE 可见性 | `resolveAuditActionVisibility` ← `allowed_actions` |
| FE 可执行 | `resolveAuditFlowExecutePermission` ← `viewer_actions` |
| FE 弹窗 | `UniAuditModal` hub + `rbacAllowed` |

## 踩坑

列表曾把非待办人的 approve/reject 从 `allowed_actions` 删掉 → `showApprove=false` → hub 无按钮；`get_approval_status` 补齐待办后只加「委托」。可见与可执行必须拆开。

列表 `batch_flow_viewer_actions` **只读、不补齐待办** → 列表态 `canExecuteByAction.approve=false`；弹窗 live 同步后按钮可点，但 `runAction`→`canRunAction` 仍用列表旧值，误报「您没有该操作权限」。审核/驳回点击门禁只验 `canReview`；待办人由弹窗 live + 后端 `execute_approval` 负责。
