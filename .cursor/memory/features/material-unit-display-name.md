---
title: 业务单位存名称直出（禁止 code→name 映射）
keywords: [单位名称, MaterialUnitLabel, useMaterialUnitOptions, base_unit, 四禁映射]
updated: 2026-10-13
---

# 业务单位存名称直出

## 何时读

改库存/工单/报工/物料单位下拉，或想「显示名称别显示编码」时。

## 标准入口（唯一真源）

| 用途 | 真源 |
|------|------|
| 单位目录可见文案 | `MaterialUnit.name` |
| 下拉 value / 业务存库 | **名称**（`useMaterialUnitOptions`：`value=name`） |
| 列表/数量旁展示 | 业务字段**直出**，禁止 code→name 对照表 |
| 历史仍存编码 | 迁移 `876_*_material_unit_business_uses_name` 回填为名称 |

## 禁止（四禁·映射）

- `buildUnitDisplayMap` / `resolveMaterialUnitLabel` 做读侧翻译
- Select `value=code` 再在展示层翻成 name
- 双路径：新数据名称、旧数据靠 map 兼容

## 踩坑

曾用展示映射绕开「名称千克 / 编码吨」脏数据，违反硬拦截。正确做法：改写路径 + 迁移回填，编码仅作目录管理字段。
