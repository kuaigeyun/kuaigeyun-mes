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
standard: 计划必绑保养方案；设备来自 scheme_type=maintenance 绑定；维护类型/周期从方案快照
---

# 保养计划方案真源

## 目标

点检计划与保养计划同一契约：计划只选方案；设备、维护类型、周期以方案及其绑定为真源。

## 何时读 / 禁止另起

- 何时读：保养计划新建/编辑、保养方案字段、执行保养选设备/方案
- 禁止：在计划表单再维护设备清单、维护类型、周期
- 禁止：读侧补丁猜类型/周期；缺参数须在方案上配置完整

## 标准入口

| 层 | 标准 |
|----|------|
| 方案真源 | `EquipmentMaintenanceScheme.maintenance_type` / `cycle_type` / `cycle_value` / `cycle_unit` |
| 设备 | `EquipmentSchemeBinding(scheme_type=maintenance)` |
| FE 计划 | `maintenance-plans` FormModal 仅绑方案；列表展示绑定台数 + 方案快照 |
| FE 方案 | `maintenance-schemes` 表单必填类型与周期 |
| BE | `MaintenancePlanService._apply_scheme_snapshots` + `_list_bound_equipment` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 模型 | `models/equipment_ops.py`、`models/maintenance_plan.py` |
| 服务 | `services/maintenance_plan_service.py`、`maintenance_reminder_service.py` |
| 迁移 | `874_..._maintenance_scheme_params.py` |
| FE | `pages/.../maintenance-plans`、`maintenance-schemes` |

## 跨端

- 移动/工位执行面：`features/equip-ops-scheme-bind-clients.md`（设备仍跟绑定；有计划则带 `maintenance_scheme_id`）

## 关联

- `features/equipment-spot-check-plan.md`
- `features/equip-ops-scheme-bind-clients.md`
