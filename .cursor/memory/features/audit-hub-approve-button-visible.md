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
  - block_reason
  - 当前节点待办人
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

流程图已到节点2、可审人是节点2，但审核按钮仍提示「当前节点待办人：节点1」：上一节点 pending 未取消，或 `block_reason` 未按 `current_node` 取待办。真源：`get_approval_status`/`bootstrap` 先取消非当前节点 pending，并清掉当前节点上不在可审名单的残留；`build_flow_viewer_actions` 的 `block_reason` 只认当前节点 pending（与可审无交集则跟可审名单）；弹窗 `disabledReason` 只用来自 live 的文案，禁止沿用列表旧 `block_reason`。

条件节点 `routeMode`（`previous_approver` / `initiator` / `formula` 三选一）：人工模式只配分支名称；选边真源 `__branch_index_{条件节点id}`（0 起），兼容读 `__branch_true_*`（true→0，false→最后一条）。`previous_approver` 时上一审批节点审核页 `current_node_decision` 多分支单选，未选禁止通过；`initiator` 时提交弹窗必选分支；`formula` 到达节点自动求值，支持最后一条「其余」，未命中且无其余则 ValidationError。禁止无选边默认走第一条。

撤回提交后重提：`cancel_approval` 须 `_strip_branch_decision_keys`；`get_approval_status` 的 `nodes_overview` 只认当前活跃实例的 tasks/history（时间线仍可跨实例），禁止上一轮「条件分支已通过」污染本轮流程图，否则审核人看不见再选是/否。

制单人 pending 无本级待办：`build_flow_viewer_actions` 须 `approve/reject=false`；弹窗 `submitterAwaitingOthers` 禁止抬升审核/驳回。节点级「撤销审核」= `recall_own`（`allowApproverRecall` 默认 true）；`viewer_may_recall_own_on_instance` 要求后续审批节点尚无人审过（空审批人 auto_pass 不阻断；禁止再用 `current_node == 下一审批节点` 卡死）。

管理员旁路只跳过 RBAC：`resolveAuditFlowExecutePermission` / 弹窗 `liveCanApprove` **禁止**因 `adminOpen` 把审核/驳回抬成可执行；已有 `viewer_actions` 时必须认 `approve/reject`。否则已审账号（尤其租户管理员）仍见蓝色「审核」，一点就「没有该审批任务」。转交/加签/委托同理须 `has_my_pending_task`。
