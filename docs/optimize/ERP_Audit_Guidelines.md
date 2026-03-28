# ERP 业务流程审计指南 (Audit Guidelines)

**审计目标**：针对制造业全业务主体，识别跨部门、跨系统的“业务盲区”与“逻辑死角”，确保数据在销售、采购、生产、仓库、质量、财务、设备、技术间的完整一致性。

---

## 🔍 核心审计原则

1. **销售为源，穿透全局**：ERP 以需定产，审计必须顺着销售需求追踪，检查信息流转是否被扭曲或丢失。
2. **状态驱动，逻辑硬锁**：拒绝口头流程，所有业务切换必须在代码层有硬性校验。
3. **中小企业 (SME) 实情适配**：审计不仅关注“有什么”，更关注“灵活性”与“管控力”的平衡（如：负库存、紧急撤回、极简开案）。

---

## 📅 10 阶段全逻辑审计体系

| 阶段 | 模块范围 | 核心审计重点 | 详细报告 |
| :--- | :--- | :--- | :--- |
| **P1** | **销售管理** | 信用/ATP/毛利预警 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_1_Sales_Audit.md) |
| **P2** | **仓储物流** | 库龄/负库存/盘点核销 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_2_Warehouse_Audit.md) |
| **P3** | **采购管理** | AVL/样品试产/LandingCost | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_3_Procurement_Audit.md) |
| **P4** | **制造执行** | 工序联锁/撤回逻辑/报工 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_4_Production_Audit.md) |
| **P5** | **工程 BOM** | 循环校验/模具寿命/ECN | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_5_Engineering_Audit.md) |
| **P6** | **质量管理** | AQL/库存锁定/COA输出 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_6_Quality_Audit.md) |
| **P7** | **财务风控** | 3-WayMatch/FX重估/尾差 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_7_Finance_Audit.md) |
| **P8** | **业务集成** | SO-WO变更联动/倒冲异常 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_8_Integration_Audit.md) |
| **P9** | **基础数据** | UoM换算/物料快速开案 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_9_Foundation_Data_Audit.md) |
| **P10** | **系统框架** | 租户隔离/审计快照/事务 | [查看报告](file:///f:/dev/riveredge/docs/optimize/Phase_10_System_Framework_Audit.md) |

---
**配置审计专题**：[Business_Config_Audit.md](file:///f:/dev/riveredge/docs/optimize/Business_Config_Audit.md)
**核心证据汇总**：[ERP_Master_Audit_Evidence.md](file:///f:/dev/riveredge/docs/optimize/ERP_Master_Audit_Evidence.md)
