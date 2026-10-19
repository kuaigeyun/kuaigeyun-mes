---
title: 保养计划方案真源（设备/类型/周期）
slug: maintenance-plan-scheme-bind
status: delivered
domain: kuaizhizao-ops
when: 改保养计划表单/创建契约、保养方案维护类型与周期、执行默认方案
keywords:
  - maintenance-plan
  - 保养计划
  - maintenance_scheme_id
  - 保养方案
  - EquipmentSchemeBinding
  - equipment_items
  - equipment_uuids
standard: 计划必绑保养方案；类型/周期取自方案；本计划设备范围写入 equipment_items；方案绑定仅作预载池
---

# 保养计划方案真源

## 目标

保养计划契约：计划选方案；维护类型/周期以方案为真源；**本计划执行设备范围**以 `equipment_items` 为真源（创建/编辑勾选写入）。

## 何时读 / 禁止另起

- 何时读：保养计划新建/编辑、保养方案字段、执行保养选设备、列表绑定台数
- 禁止：执行/列表再运行时从方案绑定轧卷覆盖 `equipment_items`
- 禁止：取消计划内勾选时去改 `EquipmentSchemeBinding`（只影响本计划）

## 标准入口

| 层 | 标准 |
|----|------|
| 方案真源 | `EquipmentMaintenanceScheme.maintenance_type` / `cycle_type` / `cycle_value` / `cycle_unit` |
| 预载池 | `EquipmentSchemeBinding(scheme_type=maintenance)` + 设备台账详情保养绑定 UI |
| 本计划设备 | `MaintenancePlan.equipment_items` + API `equipment_uuids` |
| FE 计划 | `maintenance-plans` FormModal：选方案 → `GET .../scheme-bound-equipment` 预载 → 勾选提交 |
| FE 台账 | `equipment/detail` 点检 + 保养方案绑定 |
| BE | `MaintenancePlanService._resolve_equipment_scope` + `stored_plan_equipment_items` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 模型 | `models/equipment_ops.py`、`models/maintenance_plan.py` |
| 服务 | `services/maintenance_plan_service.py`、`maintenance_reminder_service.py` |
| API | `api/maintenance_plans/maintenance_plans.py`（`scheme-bound-equipment`） |
| 迁移 | `899_..._maintenance_plan_equipment_items_backfill.py` |
| FE | `pages/.../maintenance-plans`、`equipment/detail` |

## 跨端

- 移动/工位执行面：`features/equip-ops-scheme-bind-clients.md`（有计划则带 `maintenance_scheme_id`；设备 UUID 来自计划 `equipment_items`）

## 关联

- `features/equipment-spot-check-plan.md`（已拆除，勿对标复原）
- `features/equip-ops-scheme-bind-clients.md`
