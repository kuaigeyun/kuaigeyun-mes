---
title: 审批流撤回与反审策略
keywords:
  - approval_flow_policy
  - viewer_can_revoke
  - allowSubmitterWithdraw
  - recall_own
  - reopen_final
---

## 何时读

改审批设计器撤回/反审开关、UniWorkflow 反审/撤回按钮、uni-audit withdraw/revoke/recall_own 门禁时读本笔记。

## 标准入口

| 层 | 路径 |
|---|---|
| Schema 默认值 | `riveredge-backend/src/core/schemas/approval_flow_schema.py` |
| FE Schema | `riveredge-frontend/src/types/approvalFlowSchema.ts` |
| 设计器 | `NodePropertyForms.tsx`（审批节点，转交/加签下方两栏） |
| 策略与身份 | `approval_flow_policy.py` |
| 能力下发 | `ApprovalInstanceService.get_approval_status` → `viewer_can_*` |
| 列表 audit 裁剪 | `audit_record_enricher._attach_batch_flow_withdraw_revoke` |
| API 门禁 | `uni_audit_dispatch.execute_uni_audit`（withdraw/revoke/recall_own） |
| 执行 | `UniAuditService.withdraw/revoke_with_flow_fallback`、`recall_own_approval` |
| 前端按钮 | `auditMode.resolveAuditActionVisibility` + `UniAuditActions` |

## 硬规则

- **反审**：`:revoke` 必要非充分；须为终审节点实际通过人；`allowRevokeAfterApproved`；管理员 `admin_bypass` 旁路。
- **撤回提交**：发起人；`allowSubmitterWithdraw`；可选「仅无人审批可撤」。
- **撤回本级**：节点 `allowApproverRecall`；动作 `POST .../recall_own`（review 权限）。
- **撤回门禁**：`viewer_may_recall_own_on_instance` — 本级已通过且**后续审批节点尚无人审过**（看路径上后续节点的 `approved` 任务）。空审批人 `auto_pass` 不建任务、不阻断；流程已越过下一道仍可撤。执行时清 `__branch_*` 选边。
- **撤回本级落库**：`recall_own_approval` 须**取消实例全部任务后**再为撤回节点新建一条 pending（禁止只把某一行 approved→pending 却残留另一行 approved）。否则 `bootstrap`/`_reconcile_current_node_completion` 按或签「已有通过」再次推进并清掉待办 → 报「您没有该审批任务」。
- **撤回清选边**：用 `_strip_branch_keys_after_recall`——**保留** `routeMode=initiator` 的提交选边；只清撤回点之后需重选的边。禁止一律 `_strip_branch_decision_keys`，否则概况 bootstrap 撞条件节点报「发起人须选定…」，弹窗显示成未绑定。
- **概况残留清理**：`get_approval_status` 清「不在可审名单」的 pending 时须保留 `current_approver_id`（撤回人），禁止误删后再报「没有审批任务」。
- **bootstrap 缺选边**：`_create_node_tasks(..., on_missing_branch="stop")`，不得把概况接口打成 500。
- **门禁任务范围**：`viewer_has_pending_task_on_instance` / `current_node_pending_approver_ids` 只认**当前活跃实例**的任务；`get_approval_status` 混入的同单据旧实例 pending 不得冒充可审。
- **撤回后 overview**：当前节点之后的节点不得沿用历史 auto_pass / condition_route 标「已跳过/已通过」，应 `waiting`。
- **反审落点**：终审节点 `revokeLanding` = `reopen_final` | `to_draft`（与 `reopen_at_last_approval_node` 同源终审节点）。

## 禁止

- 前端仅用 `canRevoke` 展示反审（须 `viewer_can_revoke` / `audit.viewer_can_revoke`）。
- 设计器增加「任意有 revoke 权限者可反审」类开关（身份写死终审通过人）。
- 撤回本级只改一行 task.status 而不清同节点残留 approved。
