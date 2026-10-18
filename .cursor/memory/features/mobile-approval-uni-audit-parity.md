---
title: 手机审批中心 UniAudit 对齐
keywords: mobile approval getApprovalStatus uni-audit recall_own withdraw viewer_actions
---

# 手机审批中心与 PC UniAudit 对齐

## 何时读

改 `riveredge-app/mobile` 待我审批 Tab、审批详情底栏或流程展示时。

## 标准入口

| 层 | 路径 |
|----|------|
| 详情页 | `app/(tabs)/approval/detail.tsx` |
| 流程 API | `src/services/approvalFlowService.ts`（`getApprovalStatus` / `executeUniAuditAction`） |
| 门控 | `src/utils/auditFlowViewerGate.ts` + `mobileApprovalFlowActions.ts` |
| 流程 UI | `MobileApprovalFlowPanel.tsx` |
| 更多 / 选人 | `MobileApprovalMoreSheet.tsx` + `MobileApprovalAdvancedActionModal.tsx` |
| 人员搜索 | `src/services/userDisplayService.ts` → `/core/users/display-search` |

## 契约

- 从实例 `data.entity_type` + `data.entity_id`（或 `document.entity_type`）拉 `/core/approval-instances/status`。
- 执行：`POST /core/uni-audit/{entity_type}/{entity_id}/{action}`（含 transfer/add_sign/delegate/urge）。
- 同意/驳回门控以 `viewer_actions` 为准；制单人非待办时禁用审驳（与 PC UniAuditModal hub 一致）。
- 分支条件：`current_node_decision` + `instance_data_patch`。
- 状态接口返回 `audit_resource` 供 `hasReviewPermission`。

## 撤回提交（驳回重提）

- `viewer_can_withdraw_submit` / `compute_viewer_flow_withdraw_revoke` 的 history **仅当前活跃实例**（与 `batch_flow_withdraw_revoke_flags_for_entities` 一致）；驳回重提新建实例后，旧实例上的 approve 不得阻断撤回。

## 禁止

- 仅用 `status === 'pending'` 显示同意/驳回。
- 仅走 `/approval-instances/{uuid}/action` 做 withdraw/recall_own/revoke（缺 entity 时 approve/reject 可回落实例 action）。

## 高级动作门控（与 PC UniAuditModal hub 一致）

- 转交/加签：`has_my_pending_task || admin` 且 `node_capabilities.allow_*`。
- 委托：待办人或管理员。
- 催办：制单人 + `canSubmit`（`:submit` 或 admin）。
- 底栏主按钮：同意/驳回；其余进「更多」。
