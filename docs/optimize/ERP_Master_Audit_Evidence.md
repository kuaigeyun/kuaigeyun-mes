# ERP 全模块逻辑审计 - 核心证据汇总 (ERP_Master_Audit_Evidence)

**审计目标**：识别系统逻辑“硬伤”，为后端强校验重构提供证据。

---

## 1. 销售管理 (Phase 1)
- **销售毛利实时预警缺失**：下单时不显示参考成本，无低毛利阻断逻辑，存在“越卖越赔”风险。
- **ATP 校验缺失**：无锁库逻辑，导致销售订单在无货状态下仍可确认，引发交期违约。

## 2. 仓储物流 (Phase 2)
- **物料库龄 (Aging) 分析真空**：缺乏入库时间轴追踪，无法识别呆滞料，导致库存成本隐性积压。
- **入库单价篡改**：允许操作员由于 UI 输入错误或恶意修改采购入库单价，导致库存估值瞬间失真。

## 3. 采购管理 (Phase 3)
- **样品试制 (Sample Trial) 业务断层**：缺乏小批量试产专用采购流程，样品入库干扰大货移动平均成本。
- **供应商准入（AVL）绕过**：PR 转 PO 环节允许选择未认证供应商，品质风险失控。

## 4. 生产执行 (Phase 4)
- **工单“一向听”撤回逻辑缺失**：工单下达后无法灵活撤回至草稿，仅能强制终止，导致单据号浪费与管理僵化。
- **上料批次校验真空**：报工上料不强制校验批次是否与领料批次一致，追溯链存在人为造假空间。

## 5. 工程与主数据 (Phase 5)
- **模具/工装 (Tooling) 生命管理断层**：工单创建不校验模具维保状态，产线面临停工待模风险。
- **BOM 循环引用死循环**：缺乏多级闭锁校验，MRP 运算存在宕机风险。

## 6. 质量控制 (Phase 6)
- **质检报告 (COA) 外部输出真空**：检验数据无法自动转换为给客户的质量证明书，人工二次录入成本极高。
- **拦截逻辑缺失**：不合格品判定后未自动联动锁定批次库存。

## 7. 财务与管理监控 (Phase 7)
- **期间调汇 (Revaluation) 引擎缺失**：月底外币科目无法自动重估汇兑差异，严重误导资产回报分析。
- **三单匹配（3-Way Match）断裂**：应付账款（AP）需全手工录入，未与入库单据自动对账。

## 8. 跨模块集成逻辑 (Phase 8)
- **销售 → 生产：变更管控脱节**。已下推工单的 SO 变更无硬性“冻结期”拦截或变更影响分析驱动。
- **生产 → 仓储：报工入库与 QC 强力解耦**。允许在未经 QA 评审的情况下直接执行产成品声明与过账。

## 9. 基础数据底座 (Phase 9)
- **“极简物料”快速交易支持缺失**：强资料约束导致 SME 无法在资料补全前进行紧急报价或采购响应。
- **物料单位换算因子缺失**：系统无法处理多单位间的数学换算，导致库存账实倍率性差异。

## 10. 系统级框架逻辑 (Phase 10)
- **租户隔离（Tenant Isolation）伪造风险**：API 拦截器过度依赖客户端 `localStorage` 读取 `tenant_id`，权限屏障脆弱。
- **审计日志（Audit Log）快照缺失**：全量操作日志仅支持“动作记录”，不支持数据变更前后的 JSON Diff。

---
> [!IMPORTANT]
> **最终审计结论**：系统目前正处于从“录入型”向“控制型”转型的关键封顶阶段。整改的胜算不在于 UI 的堆砌，而在于后端 `TransactionGuard`（事务卫士）对基础数据约束位（如 UoM、AVL、CreditLimit）的确权与强校验，以及框架层对“租户-用户-权限”链路的防伪重构。

---

## 改进计划分布 (Roadmap Links)
- [Phase 1: 销售管理改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_1_Sales_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 2: 仓储管理改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_2_Warehouse_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 3: 采购协同改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_3_Procurement_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 4: 生产执行改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_4_Production_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 5: 工程BOM改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_5_Engineering_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 6: 质量管理改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_6_Quality_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 7: 财务管理改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_7_Finance_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 8: 业务集成改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_8_Integration_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 9: 基础数据改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_9_Foundation_Data_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [Phase 10: 系统框架改进计划](file:///f:/dev/riveredge/docs/optimize/Phase_10_System_Framework_Audit.md#五-改进与整改计划-step-5-improvement-plan)
- [业务配置与蓝图改进计划](file:///f:/dev/riveredge/docs/optimize/Business_Config_Audit.md#四-改进与整改计划-step-4-improvement-plan)
