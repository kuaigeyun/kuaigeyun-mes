# APS-Lite 综合提升计划

> **项目真源文档** | 工单打分体系作为 M1 排序中枢，纳入 APS-Lite 六模块建设。  
> 探索性代码已合入 `develop`（commit 9125e0f1 起），上线前建议 `score_enabled=false`，完成 P0 业务决议后再启用。

---

## 1. 背景与定位

完整 APS 在中国中小制造企业落地极难：标准工时/换型/日历不准、插单频繁、维护成本高。现场真正需要的是 **今天先干哪几单、仓库先备谁的料**，而不是全厂数学最优。

**RiverEdge APS-Lite** 定位：

> 不做「替工厂算最优解」，做 **排清楚、讲明白、仓产一致**。

从重型 APS 抽取六项精华，以 **工单综合打分（M1）** 为中枢，增强现有页面（不新建顶级 APS 菜单）。

---

## 2. 六模块与页面落点

| 模块 | APS 精华 | 主页面 | 阶段 |
|------|----------|--------|------|
| **M1 打分中枢** | 可解释优先级 + CR + 齐套 | 工单列表、排程、配料中心 | P1 |
| **M2 排程可视化** | 负荷图、甘特 | `plan-management/scheduling` | P1–P2 |
| **M3 仓产联动** | 齐套驱动发料序 | `warehouse-management/batching-center`、生产领料 | P1–P2 |
| **M4 配置与沙盘** | What-if | `system/config-center`、工单插单模拟 | P3 |
| **M5 预警联动** | 交期/缺料只读提示 | `production-plans/ProductionControlTower` | P3 |
| **M6 可选** | 设备级有限产能 | 排程页 + 产能报表 | P4，非 SME 默认 |

**刻意不改**：销售/采购列表页（MTO 交期后端读 SO）；需求计算页独立，与控制塔缺料只读联动。

---

## 3. M1 工单打分中枢

### 3.1 双场景权重 profile

| 场景 | 用途 | 齐套语义 | 默认权重 |
|------|------|----------|----------|
| `scheduling` | 排程/甘特 | direct（齐套高优先开产） | due 0.35, manual 0.25, kitting 0.20, demand 0.15, plan 0.05 |
| `picking` | 备料/发料 | invert（缺料多优先备） | kitting 0.40, due 0.25, manual 0.20, demand 0.15 |

### 3.2 五维评分

- `manual_priority`：urgent=100 … low=25  
- `due_urgency`：计划完工日 + CR  
- `demand_urgency`：MTO 追溯销售交货日  
- `kitting_readiness`：齐套率（场景决定 direct/invert）  
- `plan_fidelity`：计划开工日临近加分  

### 3.3 持久化

表 `apps_kuaizhizao_work_order_scores`，唯一键 `(tenant_id, work_order_id, scenario)`。  
迁移：`279_20260521120000_create_work_order_scores_table.py`

### 3.4 消费端

| 消费端 | scenario | 排序 |
|--------|----------|------|
| 智能排产 | scheduling | composite_score DESC；**冻结单不参与自动重排** |
| 备料提醒 | picking | composite_score DESC, planned_start_date ASC |
| 工单/排程列表 | both | 展示 + Tooltip breakdown |
| 甘特默认序 | scheduling | 按综合分排序（M2） |

### 3.5 重算触发

- 定时：Taskiq 每 30 分钟  
- 事件：优先级变更、排程应用、销售交期变更、领料确认  
- 手动：`POST /work-orders/scores/batch-refresh`

### 3.6 参数

`business_config.parameters.work_order`：

- `score_enabled`（默认 true，上线建议 false 直至 P0 签字）  
- `score_stale_minutes`（默认 30）  
- `score_profiles`（JSON 权重模板）

---

## 4. M2–M6 概要

**M2 排程可视化**：甘特按综合分排序、日负荷条、冻结单 UI 标识。  
**M3 仓产联动**：备料/领料队列与 M1 picking 分一致。  
**M4 配置与沙盘**：参数台编辑权重；工单/控制塔插单模拟返回排程综合分预览（不写回）。  
**M5 预警联动**：控制塔风险表并列 rank_band / 综合分；只读，不自动重排。  
**M6 可选**：标准工时+日历可信后，设备级有限产能与 `downstream_block`。

**明确不做**：全厂多目标优化、实时全局重优化、顾问级参数工程。

---

## 5. P0 业务决议（待签字）

| # | 议题 | 建议默认 | 决议 |
|---|------|----------|------|
| 1 | 首期模块范围 | M1+M2+M3 | |
| 2 | 是否承诺 M6 | 否（可选） | |
| 3 | 首期消费端 | 排程+备料 | |
| 4 | MTO 交期来源 | 工单计划日 + 销售交货日 | |
| 5 | 备料齐套语义 | invert（缺料多先备） | |

签字：________　日期：________

---

## 6. 分期里程碑

| 阶段 | 交付 |
|------|------|
| **P0** | 本文档 + 业务决议 |
| **P1** | M1 验收；M2 甘特排序/负荷条；M3 备料一致 |
| **P2** | 冻结规则完善；领料队列；事件 hook 补全 |
| **P3** | M4 权重 UI + What-if；M5 控制塔 |
| **P4** | M6 可选 |

---

## 7. 代码索引

| 层级 | 路径 |
|------|------|
| 引擎 | `riveredge-backend/.../work_order_score_service.py` |
| 模型/迁移 | `work_order_score.py`、`279_...` |
| 排程/备料 | `advanced_scheduling_service.py`、`warehouse_service.py` |
| 工作流 | `work_order_score_workflow.py` |
| API | `api/productions/work_orders.py` |
| 前端组件 | `components/WorkOrderScoreCell` |
| 页面 | 工单列表、scheduling、batching-center、outbound、ProductionControlTower、config-center 权重模板 |

---

## 8. M1 验收 checklist

- [ ] 迁移 279 已执行  
- [x] scheduling / picking 双 profile 可配置（config-center → 计划管理）  
- [x] 智能排产、备料、列表/排程/出库 UI 读缓存分  
- [x] 优先级/排程/交期/领料/甘特拖拽改期触发重算  
- [ ] `score_enabled=false` 全链路回退（待 P0 签字后验收）  
- [x] 冻结单不参与自动重排  

**P1 代码完成**：2026-05-21（M1–M3 + M5；M4 权重 UI 已接入 config-center）

**P3 What-if**：插单模拟返回 `scheduling_score_preview`（控制塔 / 工单页只读预览，不写库）

---

*关联 Cursor Plan：`工单综合打分计划_d905c650.plan.md`*
