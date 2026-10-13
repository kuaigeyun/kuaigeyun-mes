---
title: 单位同步与物料同步拆开
slug: unit-material-sync-decouple
status: delivered
domain: sync-from-source
when: 改单位管理/物料管理同步按钮、预览映射、苍穹单位预置或误把物料编码写成单位
keywords:
  - 同步单位
  - 同步物料
  - query_measureunits
  - collapsePreviewToUniqueUnits
  - targetAliases
  - preferredApiCodeSuffixes
standard: 单位 UnitSyncFromSourceModal + unitSyncConfig；物料 MaterialSyncFromSourceModal + materialSyncConfig；禁止共用 code←number 别名顺序
---

# 单位同步与物料同步拆开

## 目标

单位管理与物料管理的同步入口、字段别名、优先接口各自独立；同源 `bd_material/batchQuery` 时也不互相改坏。

## 何时读 / 禁止另起

- 何时读：单位同步把物料编码写进单位、物料预览被收成 kg、改 SyncFromSource 全局别名
- 禁止：用「名称含单位 / select 含 baseunit」推断单位测试去重；改全局 `KINGDEE_TARGET_ALIASES.code` 顺序来「修」单位（会伤客商等）

## 标准入口

| 层 | 标准 |
|----|------|
| 单位 FE | `UnitSyncFromSourceModal` → `createUnitSyncConfig()`（`collapsePreviewToUniqueUnits` + `targetAliases` + `preferredApiCodeSuffixes: query_measureunits`） |
| 物料 FE | `MaterialSyncFromSourceModal` → `createMaterialSyncConfig()`（`targetAliases` 用 `main_code` + `preferredApiCodeSuffixes: query_material`） |
| 单位 BE | `MaterialUnitSyncService.sync_from_source` → `transform_raw_rows=collapse_material_rows_to_unique_units`（写入前去重，禁止在分页阶段去重） |
| 接口测试 | `ApiTestDrawer.isCosmicUnitSyncMaterialApi` 仅认 `query_measureunits` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 单位配置 | `riveredge-frontend/src/apps/master-data/unitSyncConfig.ts` |
| 物料配置 | `riveredge-frontend/src/apps/master-data/materialSyncConfig.ts` |
| 别名/去重工具 | `riveredge-frontend/src/components/sync-from-source-modal/syncSourceUtils.ts` |
| 类型 | `riveredge-frontend/src/components/sync-from-source-modal/types.ts` |
| 单位服务 | `riveredge-backend/src/apps/master_data/services/unit_sync_service.py` |
| 去重真源 | `riveredge-backend/src/core/services/integration/kingdee_cosmic_paths.py` |

## 踩坑

- 预览去重后 `number` 被写成单位码，正式同步若不去重仍映射 `code←number` → 物料编码进单位表
- 物料同步 `prerequisiteSteps.unit` 复用单位 binding 属有意关联，不要改成写物料 binding
- 苍穹环境无独立计量单位 API 时，单位预置名含「从物料基础单位」属路径策略，不是按钮串页
