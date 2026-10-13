---
title: 设备点检计划
slug: equipment-spot-check-plan
status: delivered
domain: kuaizhizao-ops
when: 改设备点检计划/日历/从计划生成点检单；或对标保养计划补设备作业单据
keywords:
  - spot-check-plan
  - 点检计划
  - EquipmentSpotCheckPlan
  - generate-spot-checks
  - DJJH
  - EquipmentSchemeBinding
standard: 计划只绑点检方案；周期快照自方案；设备由 EquipmentSchemeBinding 展开
---

# 设备点检计划

## 目标

补齐设备管理相对保养链路缺失的「点检计划」：绑定点检方案 + 排程窗口，一键按方案已绑定设备生成点检单。

## 何时读 / 禁止另起

- 何时读：点检计划菜单、日历、生成点检单、plan_id 溯源
- 禁止：复活旧表 `EquipmentPointInspectionPlan`；计划上再维护设备/周期第二真源；另做独立点检提醒页

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/equipment-management/spot-check-plans` + `spot-check-plan-calendar`；API `spotCheckPlanApi` |
| BE | `EquipmentSpotCheckPlan` + `equipment_spot_check_plan_service` + `/equipment-spot-check-plans` |
| 权限 | `kuaizhizao:equipment-spot-check-plan:*`；生成另需 `equipment-spot-check:create` |
| 编码 | `equipment_spot_check_plan_code` / 前缀 `DJJH` |
| 设备 | `EquipmentSchemeBinding`（`scheme_type=spot_check`），在设备台账绑定 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 模型 | `riveredge-backend/src/apps/kuaizhizao/models/equipment_spot_check_plan.py` |
| 服务 | `.../services/equipment_spot_check_plan_service.py` |
| API | `.../api/equipment_spot_check_plans/` |
| 迁移 | `859_..._equipment_spot_check_plan`、`860_..._plan_scheme_bind` |
| 列表页 | `riveredge-frontend/.../spot-check-plans/index.tsx` |

## 扩展点

1. 生成：`POST /{uuid}/generate-spot-checks` → 按方案绑定设备逐台 `EquipmentSpotCheckService.create`
2. 周期：创建/改方案时从点检方案 `cycle_type` 写入计划快照
3. 无绑定设备：生成明确报错，禁止静默跳过

## 踩坑

- 保养计划只绑方案、不取方案内周期/类型（见 `maintenance-plan-scheme-bind.md`），勿混用两套契约
- 生成鉴权 `require_all=True`：计划 update + 点检单 create

## 跨端

- 移动/工位新建点检只认绑定：`features/equip-ops-scheme-bind-clients.md`

## 关联

- `features/maintenance-plan-scheme-bind.md`
- `features/equip-ops-scheme-bind-clients.md`
- `features/equipment-ops-data-generate.md`
