---
title: 点检保养三端方案绑定对齐
slug: equip-ops-scheme-bind-clients
status: delivered
domain: kuaizhizao-ops
when: 改移动/工位新建点检、保养执行选方案；或对齐 EquipmentSchemeBinding / 保养计划 maintenance_scheme_id
keywords:
  - spot-check-conduct
  - maintenance-execution
  - EquipmentSchemeBinding
  - maintenance_scheme_id
  - 工位点检
  - 移动点检
standard: 点检/保养设备均跟 EquipmentSchemeBinding；点检无计划层；保养有计划则带 scheme_id
---

# 点检保养三端方案绑定对齐

## 目标

方案绑定契约落地后，移动与工位执行面同一真源：

1. **点检**：仅 `EquipmentSchemeBinding`（`scheme_type=spot_check`），禁止无绑定时回退全量方案；**无点检计划**（已拆除）
2. **保养执行**：有计划则传 `maintenance_plan_uuid` + 计划上的 `maintenance_scheme_id`；无计划则仅允许设备 `scheme_type=maintenance` 绑定

## 何时读 / 禁止另起

- 何时读：移动 `spot-check-conduct` / `maintenance-execution-conduct`；工位设备区点检/保养弹窗
- 禁止：移动再展示未绑定方案；保养提交不带 `maintenance_scheme_id`；工位另写第二套选方案逻辑
- 禁止：再挂点检 `planUuid` / 点检计划菜单

## 标准入口

| 端 | 路径 |
|----|------|
| PC | `equipment-management/spot-checks`、`maintenance-plans` |
| 移动 | `riveredge-app-mobile/app/equipment/spot-check-conduct.tsx`、`maintenance-execution-conduct.tsx`；保养提醒可带 `planUuid` |
| 工位 | `EquipmentStatusPanel` → `SpotCheckConductModal` / `MaintenanceExecuteModal`（挂 `StationTerminal` 右侧） |
| API | `schemeBindingsApi` / `spotChecksApi.previewLines` / `maintenancePlanApi.execute` |

## 踩坑

- 工位方式 B（仅拍照）点检不支持，引导用移动端
- 保养提醒须把 `maintenance_plan_uuid` 传入 conduct 的 `planUuid`
- 保养计划设备取 `equipment_uuids` / `equipment_items`，勿只读单字段 `equipment_uuid`

## 关联

- `features/equipment-spot-check-plan.md`（已拆除说明）
- `features/maintenance-plan-scheme-bind.md`
- `principles/three-repo-map.md`
