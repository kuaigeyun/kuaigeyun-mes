---
title: 设备点检计划（已拆除）
slug: equipment-spot-check-plan
status: removed
domain: kuaizhizao-ops
when: 误搜点检计划/DJJH/spot-check-plans 时；勿再实现计划层
keywords:
  - spot-check-plan
  - 点检计划
  - DJJH
  - equipment-spot-check-plan
  - spot-check-plans
standard: 点检只走点检方案绑定 + 点检单；造数选 spot_check_ids；保养计划仍保留
---

# 设备点检计划（已拆除）

## 结论

**点检计划整层已移除**（迁移 `887_..._drop_equipment_spot_check_plans`）。勿再加菜单、模型、API 或造数「选计划」路径。

| 仍保留 | 已删除 |
|--------|--------|
| 点检方案、`EquipmentSchemeBinding`、点检单、方案周期提醒 | `EquipmentSpotCheckPlan`、计划日历、`plan_id`/`period_key`、权限码 `equipment-spot-check-plan:*`、编码 `DJJH` |

## 何时读 / 禁止另起

- 何时读：看到旧笔记/旧截图仍提「点检计划」时，确认已拆除。
- 禁止：复原计划表；造数再写 `spot_check_plan_ids`；移动/工位再挂 `planUuid` 点检计划。

## 现行标准

| 场景 | 真源 |
|------|------|
| 手工/移动/工位点检 | 设备绑定点检方案 → `EquipmentSpotCheckService.create` |
| 造数 | `spot_check_ids` 模板展开（见 `equipment-ops-data-generate.md`） |
| 保养 | **保养计划仍保留**（`maintenance-plan-scheme-bind.md`） |

## 关联

- `features/equipment-ops-data-generate.md`
- `features/equip-ops-scheme-bind-clients.md`
- `features/maintenance-plan-scheme-bind.md`
