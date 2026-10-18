---
title: 审批驳回落点（上一级 / 制单人）
keywords: reject_target, reject_options, previous, submitter, UniAudit, approval_flow_policy
---

## 何时读

改驳回交互、流程设计器驳回落点、或 `perform_task_action` / `get_approval_status` 驳回分支时读本文。

## 标准入口

| 层 | 路径 |
|----|------|
| 策略 | `core/services/approval/approval_flow_policy.py`：`resolve_reject_options_for_instance`、`previous_approval_node_id_on_instance_path` |
| 执行 | `ApprovalInstanceService.perform_task_action` → `reject_target=previous` 时 `reject_to_previous_approval_node`；`submitter` 走原终态 `rejected` + `_handle_approval_completion` |
| 请求上下文 | `audit_reject_context.py`（uni-audit POST body `reject_target`） |
| 状态 API | `get_approval_status` 字段 `reject_options` |
| PC UI | `UniAuditModal` 驳回 Radio + `buildRejectPayload` |
| 移动 | `approval/detail.tsx` 驳回 Sheet |
| 设计器 | 节点 `rejectAllowedTargets` / `rejectDefaultTarget` |

## 契约

- `submitter`：实例 `rejected`，业务写回与「图3 驳回重提」一致。
- `previous`：实例仍 `pending`，`current_node` 回上一 approval 节点，不触发 `_handle_approval_completion`。
- 首审节点：`reject_options` 仅含 `submitter`（若策略允许）。
- 批量审批中心：首版移除「批量驳回」（须逐单选落点）。

## 禁止

- 前端硬编码允许落点；须用 `reject_options.allowed_targets`。
- 驳回到上一级时在展示层改单据 phase 冒充终态驳回。
