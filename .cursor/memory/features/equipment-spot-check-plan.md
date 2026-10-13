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
standard: 方案 → 发布计划 → 生成待执行任务 → 实际点检 → 提交审核 → 更新完成情况
updated: 2026-10-13
---

# 设备点检计划

## 目标

按用户确认的闭环执行：方案定义点检标准，草稿计划选择现有可用设备、周期、起止时间与执行人；发布固定方案和设备快照，生成待执行任务，实际填写后提交审核，审核通过后更新完成进度。

## 何时读 / 禁止另起

- 何时读：点检计划菜单、日历、生成点检单、plan_id 溯源
- 禁止：复活旧表 `EquipmentPointInspectionPlan`；生成任务时默认合格或直接待审核；另做独立任务/提醒子系统
- 本条用户决策取代此前“计划只绑定方案、设备始终按实时绑定展开”的约束。保养计划规则独立。

## 标准入口

| 层 | 标准 |
|----|------|
| FE | `pages/equipment-management/spot-check-plans` + `spot-check-plan-calendar`；API `spotCheckPlanApi` |
| BE | `EquipmentSpotCheckPlan` + `equipment_spot_check_plan_service` + `/equipment-spot-check-plans` |
| 权限 | `kuaizhizao:equipment-spot-check-plan:*`；生成另需 `equipment-spot-check:create` |
| 编码 | `equipment_spot_check_plan_code` / 前缀 `DJJH` |
| 设备 | `/equipment-options` 加载本租户现有启用且未删除、未报废设备；显式选择无需预先绑定方案，发布后使用计划快照 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 模型 | `riveredge-backend/src/apps/kuaizhizao/models/equipment_spot_check_plan.py` |
| 服务 | `.../services/equipment_spot_check_plan_service.py` |
| API | `.../api/equipment_spot_check_plans/` |
| 迁移 | `872_..._equipment_spot_check_plan`、`873_..._plan_scheme_bind`、`875_..._spot_check_plan_tasks` |
| 列表页 | `riveredge-frontend/.../spot-check-plans/index.tsx` |

## 扩展点

1. 发布：`POST /{uuid}/publish`，固定设备、采集方式、点检标准、审核人和班次；仅草稿可编辑。
2. 生成：`POST /{uuid}/generate-spot-checks`，复用 `EquipmentSpotCheck`，`period_key` 标识任务，初始“待执行”，行结果为空；计划行锁和部分唯一索引防重复。
3. 提交：现有点检单 update 校验完整实际结果、数值与照片，使用冻结标准；随后进入“待审核”，支持驳回重提。
4. 完成：审核通过才计入已完成；全部应生成任务均存在且已审核时计划“已完成”。
5. 日历和提醒按任务排程/截止时间；每班按所选班次分别生成任务。取消计划取消未提交任务，保留已提交审核历史。

## 踩坑

- 保养计划仍遵循其独立方案规则（见 `maintenance-plan-scheme-bind.md`），不得从点检新规则推导保养改造。
- 发布快照不得因方案停用、删除、绑定调整而失效；生成任务不清除强制点检标志、不发送提交审核通知。
- 历史“已发布/执行中”计划若没有发布快照，须显式重新发布才能生成新任务；已提交的历史点检单不改成待执行任务。
- 生成鉴权 `require_all=True`：计划 update + 点检单 create
- 切换方案保留计划设备；旧调用方未传设备范围时仍默认方案绑定设备，不能默认为全租户设备。

## 跨端

- 移动/工位新建点检只认绑定：`features/equip-ops-scheme-bind-clients.md`

## 关联

- `features/maintenance-plan-scheme-bind.md`
- `features/equip-ops-scheme-bind-clients.md`
- `features/equipment-ops-data-generate.md`
