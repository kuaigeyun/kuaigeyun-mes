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
- **反审落点**：终审节点 `revokeLanding` = `reopen_final` | `to_draft`（与 `reopen_at_last_approval_node` 同源终审节点）。

## 禁止

- 前端仅用 `canRevoke` 展示反审（须 `viewer_can_revoke` / `audit.viewer_can_revoke`）。
- 设计器增加「任意有 revoke 权限者可反审」类开关（身份写死终审通过人）。
