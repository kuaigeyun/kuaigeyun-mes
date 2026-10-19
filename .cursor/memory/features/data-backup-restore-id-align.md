---
title: 租户恢复 ID/UUID 对齐
slug: data-backup-restore-id-align
status: delivered
domain: system
when: 数据备份恢复后关联对不上、UUID 全变、软引用 _id 未跟偏移
keywords:
  - data backup restore
  - id remap
  - uuid collision
  - soft fk
  - data_backup_jobs
standard: restore 前 _remap_import_plan_serial_ids / _remap_import_plan_global_unique_uuids；探测排除目标租户；软引用按无歧义列名跟随
---

# 租户恢复 ID/UUID 对齐

## 目标

租户级 CSV 恢复后，主键/UUID 避让与引用列保持一致，同租户覆盖恢复不误重排。

## 何时读 / 禁止另起

- 何时读：恢复后单据挂错主数据、UUID 相对备份全变、跨租户恢复关联断
- 禁止：展示层猜 ID、恢复后手工 SQL 补丁、关掉唯一约束「先跑起来」

## 标准入口

| 层 | 标准 |
|----|------|
| BE | `restore_tenant_backup_from_dump` → serial/uuid remap → `_run_tenant_restore_transaction` |
| serial 引用 | `_fk_columns_to_serial_parents`（正式 FK + 列名无歧义软引用） |
| uuid 探测 | 有 `tenant_id` 时 `IS DISTINCT FROM` 目标租户 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 恢复/避让 | `riveredge-backend/src/core/services/system/data_backup_jobs.py` |
| 单测 | `riveredge-backend/tests/core/services/test_tenant_restore_primary_key_conflicts.py` |

## 踩坑

- UUID 冲突曾扫全表，把目标租户即将 DELETE 的旧行当成冲突 → 同租户恢复误重排
- 主键整体偏移若只改正式 FK，无 FK 的 `user_id` 等软引用会断；仅当列名在库内只指向一个 serial 父表时才跟随，歧义列（多表 `parent_id`）不猜
- 多态 `subject_id` 仍不自动偏移（需按 `subject_type` 分行），不在本条范围

## 关联

- `features/tenant-restore-self-fk-nullify.md`
- `features/data-backup-stalled-reclaim.md`
