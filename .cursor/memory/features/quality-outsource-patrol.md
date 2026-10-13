---
title: 委外检验与质量巡检
slug: quality-outsource-patrol
status: delivered
domain: quality
when: 改委外检验、质量巡检、质检方案 outsource/patrol 类型、kuaiqms 检验业务菜单序
keywords:
  - outsource-inspection
  - quality-patrol
  - OSQC
  - OUTSOURCE_INSPECTION_CODE
  - QUALITY_PATROL_CODE
  - plan_type patrol
  - outsource_receipt
standard: 执行在 kuaizhizao；菜单在 kuaiqms；OSQC 取委外收货；巡检无强制来源
---

# 委外检验与质量巡检

## 目标

补齐快质量检验链路：委外收货后独立 OSQC；以及无来源任意抽检的质量巡检。

## 何时读 / 禁止另起

- 何时读：加检验单据类型、改质检方案类型、改检验业务菜单序
- 禁止：把委外检验混进来料 IQC；为巡检再造第二套执行壳

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `quality-management/outsource-inspection`、`quality-management/quality-patrol`；API `qualityApi.outsourceInspection` / `qualityApi.qualityPatrol` |
| BE | `OutsourceInspectionService` / `QualityPatrolService`；路由挂在 `quality_execution.py` |
| 权限 | `kuaizhizao:quality-management-outsource-inspection:*`、`kuaizhizao:quality-management-quality-patrol:*` |
| 菜单 | `kuaiqms` navigation：方案→来料→委外→过程→成品→出货→首件→巡检→不良 |

## 关键文件

| 角色 | 路径 |
|------|------|
| OSQC 模型 | `riveredge-backend/src/apps/kuaizhizao/models/outsource_inspection.py` |
| 巡检模型 | `riveredge-backend/src/apps/kuaizhizao/models/quality_patrol.py` |
| 策略类型 | `inspection_policy_service.py`（`outsource`/`patrol` plan_type；物料分场景含 `osqc`） |
| 迁移 | `869_*_outsource_inspections.py`、`870_*_quality_patrols.py` |

## 扩展点

1. 方案类型：`INSPECTION_PLAN_TYPES` 含 `outsource`、`patrol`
2. 巡检套方案：服务内 `_load_patrol_template`（不走物料分场景闸门）
3. 角标：`menu_badge_counts_service._section_quality_inspection` 计入 OSQC/巡检待检
4. 收货闸门：`assert_osqc_for_outsource_receipt`；自动建单：`QualityAutomationService.maybe_auto_create_osqc_from_outsource_receipt`
5. 报表：`outsource_pass_rate` / `patrol_pass_rate`；合格率趋势含 osqc/patrol 列

## 踩坑

- aerich CLI 对远程库易挂；可用 asyncpg 直接执行迁移 SQL 并写入 `aerich` 表
- 行缓存勿在 UniTable `request` 里写（prefetch 覆盖）
- 菜单真源是 kuaiqms，不是 kuaizhizao navigation
- 质量巡检新建弹窗：`FormModalTemplate` 开 `grid` 时勿裸放 `UniMaterialSelect`（内部 `Form.Item` 不进 Col 会出格）；无明细表时用 `grid={false}` + `Row`/`Col`，或 `ProFormField` + `colProps`

## 关联

- `principles/reuse-existing-patterns.md`
- `README.md`（加路由行）
