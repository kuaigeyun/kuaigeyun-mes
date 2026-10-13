---
title: 物料分组同步空拉诊断与苍穹 createorg
slug: sync-material-group-empty-pull
status: delivered
domain: sync-from-source
when: 物料分组同步「源端未返回任何行」、BD_MATERIALGROUP、苍穹 bd_materialgroup
keywords:
  - BD_MATERIALGROUP
  - bd_materialgroup
  - material_group_sync
  - source_errors
  - createorg_number
  - FForbidStatus
standard: MaterialGroupSyncService.sync_from_source + Cosmic prepare_kingdee_cosmic_outbound
---

# 物料分组同步空拉诊断与苍穹 createorg

## 目标

物料分组入站同步在「0 行」时能暴露真实源端错误；星空过滤过严时自动全量重试；苍穹 batchQuery 带上连接器组织编码。

## 何时读 / 禁止另起

- 何时读：物料分组同步空拉、报 FormId/FilterString 误导文案、苍穹分组拉不到
- 禁止：另写一套分组同步面板；只改文案不修错误吞没

## 标准入口

| 层 | 标准 |
|----|------|
| 同步服务 | `MaterialGroupSyncService.sync_from_source` |
| 拉源 | `fetch_mapped_rows_from_sources`（`source_errors` 不得被空拉文案盖住） |
| 星空预置 | `build_material_group_query_preset_body`（FormId=`BD_MATERIALGROUP`，FieldKeys=`FID,FNumber,FName`，Filter=`FForbidStatus='A'`） |
| 苍穹预置 | `query_material_group`（及 `query_goods_class`）→ `kapi/v2/gmc/mdr_goodsclass/getMalGoodsClass`；旧 `bd_materialgroup` 由 `material_group_preset_needs_upgrade` 在「加载常用接口」时升级 |
| 苍穹商品分类 | 顶层 `pageNo`/`pageSize`（pageSize 必填），父编码 `parent_parent_number`；`ensure_kingdee_v2_request_body` 勿包 `data` |
| 苍穹发出 | `prepare_kingdee_cosmic_outbound`：有组织编码时写入 basedata `batchQuery` 的 `data.createorg_number` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 同步 | `riveredge-backend/src/apps/master_data/services/material_group_sync_service.py` |
| 苍穹路径 | `riveredge-backend/src/core/services/integration/kingdee_cosmic_paths.py` |
| 苍穹预置 | `riveredge-backend/src/core/services/integration/kingdee_cosmic_api_presets.py` |
| 星空预置 | `riveredge-backend/src/core/services/integration/kingdee_galaxy_api_presets.py` |
| 有效过滤 | `riveredge-backend/src/core/services/integration/kingdee_active_scope_filter.py` |

## 扩展点

1. 其它主数据空拉：复用「有 `source_errors` 先抛真实错误；`active_only` 空结果再试全量」
2. 苍穹其它 basedata batchQuery：走同一 `prepare_kingdee_cosmic_outbound`，勿再为单对象复制注入逻辑

## 踩坑

- 旧逻辑：`fetched==0` 一律抛「FormId 是否为 BD_MATERIALGROUP」，即使 `source_errors` 已有鉴权/字段错误
- **名对体错**：接口名/code 为 `query_material_group`，但 `request_body` 仍是物料查询（`FormId=BD_MATERIAL`，FieldKeys 含 `FMaterialGroup.*`）；字段映射也常误成 `FMaterialGroup.FNumber/FName`。正确应为 `FormId=BD_MATERIALGROUP`，FieldKeys=`FID,FNumber,FName`，映射 `FNumber→code`、`FName→name`
- 星空：分组常无 `FDocumentStatus`；Filter 带已审核会整页 0 行或查询失败
- 苍穹：空 `data: {}` 在部分账套拉不到行；连接器须填组织编码；非仓库对象不要伪造默认 `WANG`
- 已保存的旧预置：连接器「加载常用接口」升级 `query_material_group`（苍穹识别 `bd_materialgroup` 路径；星空识别错误 FormId）
- 调测仍见 `Cannot found OpenAPI ... bd_materialgroup`：接口管理里尚未升级，须再点「加载常用接口」或手工改路径为 getMalGoodsClass
