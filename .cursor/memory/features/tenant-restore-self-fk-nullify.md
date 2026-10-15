---
title: 租户恢复自引用外键置空
slug: tenant-restore-self-fk-nullify
status: delivered
domain: system
when: 租户级备份恢复失败、core_departments parent_id、fk_core_departments_parent_id、自引用 FK
keywords:
  - tenant restore
  - core_departments
  - parent_id
  - fk_core_departments_parent_id
  - self-referential
  - data_backup_jobs
standard: restore.sql 在重建 FK 前对自引用列 NULL 悬空值；勿因 parent_id 删整行部门
---

# 租户恢复自引用外键置空

## 目标

租户级 CSV 恢复在临时 DROP FK → COPY → 重建 FK 时，不因 `core_departments.parent_id` 等自引用悬空而整单回滚。

## 何时读 / 禁止另起

- 何时读：租户恢复报 `fk_core_departments_parent_id` / `Key (parent_id)=(...) is not present`
- 禁止：在展示层猜父部门、恢复后手工 SQL 补丁、为「先跑起来」关掉该 FK 永久不建

## 标准入口

| 层 | 标准 |
|----|------|
| BE | `restore_tenant_backup_from_dump` → `_run_tenant_restore_transaction` |
| 自引用处理 | `_append_self_referential_fk_nullify`（重建约束前） |
| 普通孤儿 | `_append_fk_orphan_cleanup`（多轮 DELETE；**跳过** child==parent） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 恢复事务 | `riveredge-backend/src/core/services/system/data_backup_jobs.py` |
| 单测 | `riveredge-backend/tests/core/services/test_tenant_restore_source_scope.py` |

## 过程

1. 导入表 FK 先 DROP，COPY 整表（行序不再卡自引用）
2. 非自引用 FK：多轮按租户删孤儿子行（避免先删父、后遗子）
3. 自引用 FK：同租户父行不存在则 `SET col = NULL`（保留部门行，避免串租户同 id）
4. 再 ADD CONSTRAINT

## 踩坑

- 报错文案像 INSERT，实际常是 **ADD CONSTRAINT** 校验失败
- 孤儿清理若按 `manager_id` 等删掉父部门，子行 `parent_id` 会事后悬空——必须在重建前 nullify
- PostgreSQL FK **不按 tenant_id**；同 id 跨租户父行会误通过，nullify 必须带 `p.tenant_id = c.tenant_id`

## 关联

- `features/data-backup-stalled-reclaim.md`
- `features/data-backup-csv-dump-newline.md`
