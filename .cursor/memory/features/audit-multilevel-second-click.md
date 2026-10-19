---
title: 多级审核第二级一次点击即可
slug: audit-multilevel-second-click
status: delivered
domain: approval
when: 多级审核第二级要点两次、第一次点击无效果、审核前 reconcile 吃掉待办、列表分不清已审未审、待我审核、您已审核
keywords:
  - UniAuditModal
  - approve_with_flow_fallback
  - get_approval_gate_status
  - my_acted
  - 待我审核
  - 您已审核
  - 第二级
  - 点两次
standard: 审核前只读 pending；列表审核状态按 viewer_actions 显示待我审核或您已审核
---

# 多级审核第二级一次点击即可

## 目标

多级审批流在第二级（及后续节点）一次点击「审核」即完成投票，不再出现第一次空跑、第二次才生效。

## 何时读 / 禁止另起

- 何时读：多级审核要点两次、第一级正常第二级异常、审核成功但节点未推进
- 禁止：在 approve/reject 路径再调带 reconcile 的 `get_approval_status`；禁止 `_check_node_completion` 在找不到节点时冒充已通过

## 标准入口

| 层 | 路径 |
|----|------|
| BE 门面 | `uni_audit_service._has_pending_flow_instance` → `execute_approval` |
| BE 门控 | `audit_flow_guard.get_approval_gate_status`（只读 instance） |
| BE 投票 | `execute_approval` 仅 `_sync_node_approver_tasks`，不 bootstrap+reconcile |
| BE 完成判定 | `_check_node_completion`：规范化图 + str(id)；缺配置 → pending |
| FE 弹窗 | `UniAuditModal`：`flowLoading` 时禁用审核；live 后再可点；同人下级保持打开 |
| FE 列表 | `AuditPhaseBadge`：待我审核 / 您已审核 / 待审核；`UniAuditActions` 未轮到且不能撤回时按钮置灰 |
| BE 列表 | `build_flow_viewer_actions.my_acted`：本人已有 approved 任务且当前节点不再是他的待办 |
| BE 销售订单 | `list_sales_orders` / `get_sales_order_by_id` → `apply_viewer_flow_gate_after_capabilities`（与采购申请同源） |
| BE 挂载条件 | `_attach_batch_viewer_actions`：`phase==pending` 即挂（不依赖 `audit.enabled`；进行中实例在开关关闭后仍须展示） |

## 踩坑

1. `approve_with_flow_fallback` / `assert_pending` 曾调 `get_approval_status`，打开弹窗后再点审核会再 reconcile；或签误判完成会取消当前待办，第一次点击失败。
2. `_check_node_completion` 曾用裸 `node.id == current_node` 且缺配置返回 `approved`，ID 类型不一致时会在投票前推进。
3. 弹窗在 live 未返回时若列表 `canExecute=true`（无 viewer_actions 时门禁放行），会在待办未就绪时发出第一次请求。
4. 销售订单列表曾只写 `derive_audit_phase`、未传 `viewer_id`，浏览器永远只见「待审核」；实测补齐后再验。
5. 挂载曾要求 `audit.enabled`，租户关掉绑定但实例仍 pending 时列表不挂 `viewer_actions`。

## 列表按当前人提示

整单相位仍是待审核。对当前登录人：

- 持有当前节点待办：徽章「待我审核」，审核按钮可点
- 已通过某一级且不再持有当前待办：徽章「您已审核」，按钮文案改为「您已审核」（提交人仍可打开弹窗撤回）
- 既未审过也未轮到，且没有撤回：审核按钮置灰，悬停为当前待办人

同一人连续两级时 `my_acted` 为 false，仍显示「待我审核」。

## 关联

- `features/audit-hub-approve-button-visible.md`
- `features/finance-ar-ap-audit-writeback.md`（流程已过单据仍待审的另一类「审两遍」）
