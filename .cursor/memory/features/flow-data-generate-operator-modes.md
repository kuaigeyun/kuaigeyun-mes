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
  - 工序流转
  - allow_jump
  - FlowGenerateJobService
  - 造数进度
standard: StepOperatorConfig.mode + 前端各步骤 op_mode_*；报工按工序在 _step_reporting 解析；质检步骤走 quality_service + resolve_inspection_policy；跨工序时刻走 _operation_flow_gap_seconds；执行走异步 job 轮询
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
| `incoming_inspection` | 从 PO 下推来料检（`force_simple_when_unset`：无质检/无方案按简易）→ conduct 全合格 → 审核 → 下推入库确认；建单失败再回退直接入库 |
| `process_inspection` | 报工后按工序建/复用过程检（同样强制简易）→ conduct+审核 |
| `finished_goods_inspection` | 成品检强制简易 + `_pass_quality_inspection` |
| `finished_goods_receipt` | 一键入库后自动 `confirm_receipt`；半成品走 `SemiFinishedGoodsReceiptService` 并记 `semi_finished_goods_receipt` |

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

## 失败策略（单项跳过，其余继续）

| 阶段 | 行为 |
|------|------|
| 需求计算 / 一键下推 | 硬失败：撤销本轮写入（软删时间线 + `withdraw_from_computation`） |
| 采购下推无默认供应商 | 正式下推 `fill_missing_supplier="random"`：随机启用供应商填入；仍无可用供应商才跳过该物料（提示进 `warnings`） |
| 单据备注 | 造数不写业务备注：`omit_document_notes=True`；补库/报工/点检保养也不写 `notes`/`remarks`/`remark` |
| 采购单 / 工单生产链 / 发货 | **单条失败跳过**该 PO/工单/发货，记入 `errors` 与 `step_results.status=skipped`，**其余继续写入**，成功单据照常改写时间 |
| 质检无方案 / none | 造数步骤传 `force_simple_when_unset=True`，按简易质检建单，不整轮跳过 |

返回 `success: true` + `errors`（跳过原因列表）。前端有跳过时 warning，结果表仍展示已写入时间线。

## 工序流转间隔与预览

- `_operation_flow_gap_seconds`：跨工序推进业务时刻；须完上道用上道 `setup+standard×qty`（小时→秒，钳在 `OP_FLOW_GAP_*`）；下道 `allow_jump` 时仅占 `OP_JUMP_GAP_RATIO`；无工时则回退报工步骤间隔。
- `_step_reporting`：工序间先 `advance_by_seconds(gap)`，首批 `planner.current()`，同工序后续批次 `planner.next("reporting")`。
- `preview`：`_resolve_source_process_operations` 从源单首个可解析工艺物料展开报工节点（含流转/工时备注）；解析不到则只显示总报工步骤。

## 异步执行（防 504）

| 项 | 真源 |
|----|------|
| 启动 | `POST .../management/flow-generate` → 立即返回 `job_id`（`FlowGenerateJobService` 进程内） |
| 进度 | `GET .../management/flow-generate/jobs/{job_id}`：`progress` / `message` / `status` |
| FE | `executeFlowGenerate` 轮询 + `Progress`；结果在 `job.result` |

禁止再把同步长请求当默认路径（网关易 504）。

## 操作日志同步

每张本轮生成的业务单据经 `_record_step` → `OperationLog`（`operation_type=flow_generate`），成功后再 `_rewrite_timeline` + `_align_operation_logs`（日志 `created_at` = 时间线 `issued_at`）。`_rewrite_timeline`：`rewrite_code_date`（报工除外）对齐单号日期与 `updated_at`；任一类 `failed>0` 即抛错；成功后把新单号回写时间线 `doc_code`。单据时间改写须在 `DocumentTimeRewriteService.REWRITE_SPECS` 登记对应 `doc_type`（含 `process_inspection` / `outsource_work_order` / `semi_finished_goods_receipt`），否则收工改写会失败。

不单独记日志：源销售订单/预测（输入）、PO 审核动作本身（单据已在下推时记过）。委外工单记日志并改写时间，本版仍不自动走委外收发。

## 关键文件

| 角色 | 路径 |
|------|------|
| 页 | `riveredge-frontend/src/apps/kuaizhizao/pages/app-management/flow-data-generate/index.tsx` |
| 服务 | `riveredge-backend/src/apps/kuaizhizao/services/flow_data_generate_service.py` |
