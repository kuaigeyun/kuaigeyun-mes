---
title: 流程造数步骤操作用户模式
slug: flow-data-generate-operator-modes
status: delivered
domain: kuaizhizao-ops
when: 改流程造数操作用户、按部门/小组/工序取人、flow-data-generate
keywords:
  - flow-data-generate
  - StepOperatorConfig
  - random_department
  - random_team
  - operation_assigned
  - 流程造数
  - incoming_inspection
  - process_inspection
  - 来料检验
  - 过程检验
standard: StepOperatorConfig.mode + 前端各步骤 op_mode_*；报工按工序在 _step_reporting 解析；质检步骤走 quality_service + resolve_inspection_policy
---

# 流程造数步骤操作用户模式

## 目标

运维造数页为各步骤配置操作人来源，生成更真实的创建人/报工人；制造链含来料/过程检验（按物料/工序 none/simple/plan）。

## 何时读 / 禁止另起

- 何时读：扩展造数操作用户策略、报工操作人池、来料/过程检验造数步骤。
- 禁止：另写一套选人 UI 或旁路 `StepOperatorConfig`；在 purchase 步骤内再埋 IQC。

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/app-management/flow-data-generate/index.tsx` + `services/flow-data-generate.ts` |
| BE | `flow_data_generate_service.StepOperatorConfig` / `_pick_operator_for_step` / `_step_reporting` |
| 质检 | `_step_incoming_inspection` / `_step_process_inspection` → `IncomingInspectionService` / `ProcessInspectionService` + `resolve_inspection_policy` |
| API | `management.StepOperatorBody` |

## STEP_KEYS（质检相关）

| key | 行为 |
|-----|------|
| `purchase` | 审核 PO；若未勾选 `incoming_inspection` 则直接 `push_to_receipt`+确认 |
| `incoming_inspection` | 从 PO 下推来料检（物料 IQC≠none）→ conduct 全合格 → 审核 → 下推入库确认；全无检则回退直接入库 |
| `process_inspection` | 报工后按工序 IPQC≠none 建/复用过程检 → conduct+审核 |
| `finished_goods_inspection` | 成品检同样 `_pass_quality_inspection` |

来料步骤依赖采购已开且有 PO；过程检依赖报工后的工单工序。

## 模式

| mode | 参数 | 行为 |
|------|------|------|
| `random_role` | `role_code?` | 角色下激活用户随机（步骤默认角色） |
| `random_department` | `department_id` | 部门下激活用户随机 |
| `random_team` | `work_group_id` | 工作小组成员随机 |
| `operation_assigned` | — | 报工：工单工序派工 → 工序档案默认人员 → 小组；其它步骤：工序默认人员池随机 |
| `fixed` | `user_id` | 指定人员 |
| `current` | — | 当前登录用户 |

池空一律回退当前用户。造数页不进平台更新日志（运维工具）。Windows 改 BE 后须重启 API（无热重载）。

## 关键文件

| 角色 | 路径 |
|------|------|
| 页 | `riveredge-frontend/src/apps/kuaizhizao/pages/app-management/flow-data-generate/index.tsx` |
| 服务 | `riveredge-backend/src/apps/kuaizhizao/services/flow_data_generate_service.py` |
