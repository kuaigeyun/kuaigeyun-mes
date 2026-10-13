---
title: 保养计划绑定保养方案
slug: maintenance-plan-scheme-bind
status: delivered
domain: kuaizhizao-ops
when: 改保养计划表单/创建契约、执行默认方案、保养方案绑定字段
keywords:
  - maintenance-plan
  - 保养计划
  - maintenance_scheme_id
  - 保养方案
standard: 计划必绑保养方案；设备/维护类型/周期仍在计划上维护，不从方案带出参数
---

# 保养计划绑定保养方案

## 目标

保养计划增加必填 `maintenance_scheme_id`（及 code/name 快照），执行弹窗默认带出计划已绑方案。

## 何时读 / 禁止另起

- 何时读：保养计划新建/编辑、执行保养选方案
- 禁止：把维护类型/周期迁到保养方案再回填计划（点检计划才是「方案为真源」）
- 禁止：与点检计划一样取消计划上的设备字段

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/equipment-management/maintenance-plans` FormModal 必选保养方案 |
| BE | `MaintenancePlan.maintenance_scheme_id` + `MaintenancePlanService._resolve_maintenance_scheme` |
| 执行 | `MaintenanceExecutionCreate` 未传方案时默认取计划上的 scheme |

## 关键文件

- `models/maintenance_plan.py`
- `schemas/maintenance_plan.py`
- `services/maintenance_plan_service.py`
- 迁移 `860_..._plan_scheme_bind.py`

## 跨端

- 移动/工位执行面：`features/equip-ops-scheme-bind-clients.md`

## 关联

- `features/equipment-spot-check-plan.md`
- `features/equip-ops-scheme-bind-clients.md`
