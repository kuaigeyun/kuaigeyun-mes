---
title: 设备点检保养造数与点检单导入
slug: equipment-ops-data-generate
status: delivered
domain: kuaizhizao-ops
when: 改设备点检造数、保养执行造数、点检单 Excel 导入、flow-data-generate Tab
keywords:
  - equipment-ops-generate
  - spot-check
  - 点检单导入
  - 保养执行造数
  - flow-data-generate
  - spot_check_ids
  - maintenance_plan_ids
standard: 造数走 management/equipment-ops-generate；点检选 spot_check_ids 模板；保养仍选 maintenance_plan_ids
---

# 设备点检保养造数与点检单导入

## 目标

运维页按**点检单模板 / 保养计划**批量生成点检单/保养执行；点检单列表支持 Excel 导入。

## 何时读 / 禁止另起

- 何时读：扩展造数范围、点检导入列、工作时段钳制、模板周期展开。
- 禁止：另写点检 create 旁路；造假照片；新增菜单；再按「全部启用设备」扫台账。
- 禁止：再写 `spot_check_plan_ids`（点检计划已拆除）。

## 标准入口

| 层 | 标准 |
|----|------|
| FE 造数 | `flow-data-generate` Tab + `EquipmentOpsGeneratePanel` |
| FE 导入 | 造数 Tab `EquipmentOpsGeneratePanel` + 点检单列表；共用 `spotCheckExcelImport.ts` |
| BE | `equipment_ops_data_generate_service` + `management.py` |
| 权限造数 | `kuaizhizao:app-management:flow-generate` + 管理员门禁 |
| 权限导入 | `kuaizhizao:equipment-spot-check:import` |

## 造数契约

- **选模板**：`spot_check_ids`（已有点检单作模板）与/或 `maintenance_plan_ids`（至少一类）
- **选设备**：`equipment_ids`；点检侧须落在模板设备/方案绑定可执行范围内；保养侧仍须是所选计划设备并集子集
- **周期展开**：点检按模板关联方案 `cycle_type`（每班/每天/每周/每月/每季度）；保养按计划/方案时间周期；日期范围内每周期一张，单目标上限 90
- **写单**：`EquipmentSpotCheckService.create` + 填行/可选审核；`MaintenanceExecutionService.create_maintenance_execution`
- **操作日志**：每张落库单据 `_attach_ops_log`（`operation_type=equipment_ops_generate`）；成功后改写业务时刻并对齐日志 `created_at`
- **全有或全无**：任一条硬失败 → 软删本轮时间线单据、删除对应操作日志 → 400「请修改后重试」
- **操作人**：复用 `StepOperatorConfig`；执行人优先设备点检人；审批人默认方案审核人
- 采集方式 B 跳过；Windows 改 BE 后须重启 API；造数页不进平台更新日志

## 关键文件

| 角色 | 路径 |
|------|------|
| 造数面板 | `riveredge-frontend/.../flow-data-generate/EquipmentOpsGeneratePanel.tsx` |
| API FE | `riveredge-frontend/.../services/equipment-ops-data-generate.ts` |
| 服务 BE | `riveredge-backend/.../equipment_ops_data_generate_service.py` |
| 点检计划（已拆） | `features/equipment-spot-check-plan.md` |
