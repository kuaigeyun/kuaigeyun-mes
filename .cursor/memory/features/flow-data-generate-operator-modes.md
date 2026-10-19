---
title: 流程造数步骤操作用户模式
slug: flow-data-generate-operator-modes
status: delivered
domain: kuaizhizao-ops
when: 改流程造数操作用户、按部门/小组/工序取人、flow-data-generate、预检、工单自选并行
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
  - precheck
  - selected_material_ids
  - parallel_work_orders
  - parallel_group_size
  - flow_end_at
  - revert_run
  - outsource
  - force_simple_when_unset
standard: StepOperatorConfig.mode + 前端各步骤 op_mode_*；报工按工序在 _step_reporting 解析；质检走 resolve_inspection_policy（不强制简易）；委外 _step_outsource_fulfillment；跨工序 advance_capped+标准工时；异步 job；precheck；失败不跳过；完整 MES 仿真
---

# 流程造数步骤操作用户模式

## 目标

运维造数页为各步骤配置操作人来源，生成更真实的创建人/报工人；制造链含来料/过程检验（按物料/工序 none/simple/plan）。支持数据预检、工单物料自选与多工单并行完工。

## 何时读 / 禁止另起

- 何时读：扩展造数操作用户策略、报工操作人池、来料/过程检验造数步骤、预检/自选/并行。
- 禁止：另写一套选人 UI 或旁路 `StepOperatorConfig`；在 purchase 步骤内再埋 IQC；业务失败再「跳过继续」。

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/app-management/flow-data-generate/index.tsx` + `services/flow-data-generate.ts` |
| BE | `flow_data_generate_service.StepOperatorConfig` / `_pick_operator_for_step` / `_step_reporting` |
| 质检 | `_step_incoming_inspection` / `_step_process_inspection` → `IncomingInspectionService` / `ProcessInspectionService` + `resolve_inspection_policy` |
| API | `management.StepOperatorBody` / `FlowGenerateBody` |

## STEP_KEYS（质检 / 委外）

| key | 行为 |
|-----|------|
| `purchase` | 审核 PO；若未勾选 `incoming_inspection` 则按交期推进后 `push_to_receipt`+确认 |
| `incoming_inspection` | `_pace_purchase_to_delivery` → 从 PO 下推来料检（`force_simple_when_unset=False`）→ conduct+审核 → 下推入库 → **逐张**确认；策略为无质检/无可检行 → 直入库；其它建单失败仅 `allow_skip_iqc` 旁路 |
| `outsource` | 委外工单：下达 → 缺料其他入库补库 → 批量发料 → 全量合格收货；改写 `outsource_material_issue` / `outsource_material_receipt` |
| `process_inspection` | 报工后按工序建/复用过程检（真方案）；无质检跳过该工序，全部无质检则整步跳过 |
| `finished_goods_inspection` | 成品检走真策略；无质检则跳过，不强制简易 |
| `finished_goods_receipt` | 一键入库后自动 `confirm_receipt`；半成品走 `SemiFinishedGoodsReceiptService` 并记 `semi_finished_goods_receipt` |

来料步骤依赖采购已开且有 PO；过程检依赖报工后的工单工序；委外依赖需求计算下推产生的 OWO。

## 模式

| mode | 参数 | 行为 |
|------|------|------|
| `random_role` | `role_code?` | 角色下激活用户随机（步骤默认角色） |
| `random_department` | `department_id` | 部门下激活用户随机 |
| `random_team` | `work_group_id` | 工作小组成员随机 |
| `operation_assigned` | — | 报工：工单工序派工 → 工序档案默认人员 → 小组；其它步骤：工序默认人员池随机 |
| `fixed` | `user_id` | 指定人员 |
| `current` | — | 当前登录用户 |

`random_*` 池空：预检 `EMPTY_OPERATOR_POOL` + 执行抛错（禁止回退当前用户）。`current`/`fixed`/`operation_assigned` 仍可回退。造数页不进平台更新日志（运维工具）。Windows 改 BE 后须重启 API（无热重载）。

## 数据预检 / 工单自选 / 并行 / 物料 ID 修复

| 项 | 真源 |
|----|------|
| 预检 | `POST .../flow-generate/precheck` → `FlowDataGenerateService.precheck` |
| 硬拦 | 无工艺；启用领料/报工时无 BOM（`NO_BOM`）；采购且组织无启用供应商（`NO_SUPPLIER_POOL`）；自动生成工单关（`AUTO_WO_DISABLED`）；`random_*` 池空（`EMPTY_OPERATOR_POOL`） |
| 返回 | `blocking_codes` + `errors`/`warnings`；FE 展示编码与文案 |
| 旁路开关 | `allow_skip_iqc`（默认 false）：来料检建单失败才允许直入库 |
| 候选 | 源单自制件行 → `work_order_candidates`（工艺/BOM/就绪） |
| 自选 | `selected_material_ids`：下推后按 `product_id` 过滤，只对这些工单走生产链 |
| 并行 | `parallel_work_orders=true`：`fork` 后按工单下标 `advance_capped` 错开产能起点，再 `gather`，结束后 `bump_to` |
| 数量并行组 | `parallel_group_size_min/max`：把工单数量拆成多组；同工序组1→间隔→组2…；未设则走 `reporting_batches` |
| 起止时间窗 | `flow_end_at` + `anchor_at`：按**工作秒**均摊；跨工序仍按标准工时意图推进，超额由 `advance_capped` 压回剩余工作秒；禁止关工作时段避超窗 |
| 时刻 | 禁止整秒；开钳时锚点/推进/`current` 均 `_normalize_to_work`，不得落凌晨；采购入库对齐 `delivery_date` |
| 手动撤回 | `POST .../flow-generate/revert` `{run_id}` → `revert_run`：按检查点软删时间线单据 + `withdraw_from_computation` |
| 物料 ID 修复 | `POST .../flow-generate/repair-material-ids`：按行 `material_code`+`material_name` 匹配主数据回写 `material_id` |

预检错误文案须带行上编码与名称。`material_id_issues` / `can_repair_material_ids` 驱动 FE「修复物料ID」按钮；修复后自动再预检。

执行前 FE 须先预检通过；有自制件候选时须至少勾选一项。

## 失败策略（不再跳过）

| 阶段 | 行为 |
|------|------|
| 需求计算 / 一键下推 | 硬失败：撤销本轮写入（软删时间线 + `withdraw_from_computation`） |
| 采购下推无默认供应商 | 预检硬拦组织无启用供应商；执行仍可用 `fill_missing_supplier="random"`（池非空时） |
| 提交再审核 | 采购/报工：草稿或驳回先 `submit_*`，待审再 `approve_*`；领料 `_ensure_picking_ready_to_confirm`；出库 `_ensure_sales_delivery_ready_to_confirm`；已确认跳过；禁止直接审草稿 |
| 单据备注 | 造数不写业务备注：`omit_document_notes=True` |
| 采购单 / 工单生产链 / 发货 | **任一条失败即整轮失败**，job=`failed`；已写入单据保留供排查（不伪装 success） |
| 多下游单据 | 来料检多入库 `_confirm_purchase_receipts`；发货 `related_sales_delivery_ids` 全部确认 |
| 补库/领料确认 | 确认失败抛错（`_is_already_done_error` 除外），禁止吞错继续 |
| 来料检建单失败 | 无质检/无可检行 → 直入库；其它失败默认整轮失败，仅 `allow_skip_iqc` 旁路；下推入库失败不得静默跳过 |
| 已完成幂等 | `_is_already_done_error`（已审核/已确认等）仍视为可继续 |
| 质检策略 | `force_simple_when_unset=False`：有方案走真方案；`none` 跳过/直入库（`_is_no_inspection_needed_error`） |
| 委外收发 | `_step_outsource_fulfillment`；已收齐则跳过；失败整轮失败 |
| 中断续跑 | `resume_run_id`：从 `OperationLog(flow_generate)` 恢复检查点；跳过已完成需求计算/下推/已入齐 PO/已完成工单/已出库/已收齐委外；业务流转失败抛 `FlowGenerateFailedError`（`resumable`+`run_id`）；FE「继续未完成」 |

## 工序流转间隔与预览

- `_operation_flow_gap_seconds`：跨工序推进业务时刻；须完上道用上道 `setup+standard×qty`（小时→秒，钳在 `OP_FLOW_GAP_*`）；下道 `allow_jump` 时仅占 `OP_JUMP_GAP_RATIO`；无工时则回退报工步骤间隔。
- `_step_reporting`：工序间 `advance_capped(gap)`；同工序各组/批 `planner.next("reporting")`；`work_hours` 按准备+标准×本组数量写入。
- `preview`：展开工序×组节点；有 `flow_end_at` 时返回 `suggested_intervals` / `estimated_finish_at`；单据不写业务备注（`omit_document_notes`）；`updated_at` 随改写与 `created_at` 同刻。

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
| API | `riveredge-backend/src/apps/kuaizhizao/api/management.py` |
