---
title: 数据备份定时存储与定期清理
slug: data-backup-policy-schedule-storage
status: delivered
domain: system
when: 改数据备份定时、落点（本机/COS/MinIO）、保留天数或份数清理
keywords:
  - data-backups
  - data_backup_policy
  - 定时备份
  - 对象存储
  - retention
standard: SiteSetting/PlatformSettings.data_backup_policy + data_backup_policy_tick + create_backup_task
---

# 数据备份定时存储与定期清理

## 目标

组织与平台可配置：定时备份、本机或应用连接器对象存储（腾讯 COS / MinIO）、按天数或最近份数清理成功备份。

## 何时读 / 禁止另起

- 何时读：备份策略、定时备份、备份落 COS/MinIO、自动删备份
- 禁止：另起 Celery/APScheduler；把系统备份塞进 kuaizhizao `SCHEDULED_JOB_PRESETS`；未适配的 OSS/S3 连接类型用兜底路径冒充成功

## 标准入口

| 层 | 标准 |
|----|------|
| FE | 数据备份页「备份策略」→ `BackupPolicyModal`（本组织 / 全平台 Tab） |
| FE 定时 UI | 按天 / 按周 / 按月 + `TimePicker`，内部拼五段 cron（勿再暴露高级 Cron） |
| FE 清理 UI | 模式单选 none/days/keep_count + 天数/份数 `Select` 预设（`RETENTION_DAYS_OPTIONS` / `RETENTION_KEEP_OPTIONS`） |
| BE 租户策略 | `Depends(get_current_tenant)`（认 `X-Tenant-ID`），勿用 `User.tenant_id` 判「未绑定」 |
| FE 组织上下文 | 弹窗展示「组织名 + 租户号」；平台管理员 `getTenantList(..., true)` 选组织，策略/连接请求显式带 `X-Tenant-ID` |
| BE 策略 | `SiteSetting.settings.data_backup_policy`；平台 `PlatformSettings.data_backup_policy` |
| BE API | `GET/PUT /core/data-backups/policy`；`…/policy/platform`；`POST …/policy/run-now`；`POST …/policy/platform/run-now`；`…/storage-connections` |
| 调度 | Taskiq `data_backup_policy_tick`（每分钟）→ `create_backup_task` / retention |
| 立即测试 | 策略弹窗「立即测试备份」→ 先保存再 `run_policy_backup_now`（不写 `last_scheduled_at`） |
| 落盘 | dump 成功后 `upload_backup_to_object_storage_if_needed`；下载/恢复 `ensure_local_backup_file` |

## 关键文件

| 角色 | 路径 |
|------|------|
| 策略服务 | `riveredge-backend/src/core/services/system/data_backup_policy.py` |
| API | `riveredge-backend/src/core/api/data_backups/data_backups.py` |
| 模型 | `riveredge-backend/src/core/models/data_backup.py`（storage_* / trigger_source） |
| 平台字段 | `riveredge-backend/src/infra/models/platform_settings.py` |
| Tick | `riveredge-backend/src/core/tasks/taskiq_app.py` |
| Handler | `riveredge-backend/src/core/tasks/data_backup_handlers.py` |
| FE 弹窗 | `riveredge-frontend/src/pages/system/data-backups/BackupPolicyModal.tsx` |
| FE 列表 | `riveredge-frontend/src/pages/system/data-backups/index.tsx` |
| 客户端 | `riveredge-frontend/src/services/dataBackup.ts` |
| 迁移 | `migrations/models/858_20261012090000_data_backup_policy_storage.py` |

## 扩展点

1. 新对象存储类型：先在 `SUPPORTED_OBJECT_STORAGE_TYPES` + 适配器落地，再允许备份策略选用（RustFS 见 `connector-storage-rustfs.md`）
2. 定时参数：改 policy JSON，勿平行第二套调度表

## 踩坑

- 路由须把 `/policy`、`/policy/run-now`、`/storage-connections` 注册在 `/{uuid}` 之前
- 全平台对象存储须固化 `storage_owner_tenant_id`（连接所属组织），禁止猜默认连接
- Cron 按站点墙钟（`to_site_timezone` + `match_cron`），禁止硬 +8
- 清理只动 `status=success` 且 `source_type=generated`，跳过 `restore_status=running`
- 平台账号 `User.tenant_id` 常为空：前端用 `getTenantId()` / 当前用户组织，后端用 `get_current_tenant`，禁止再弹「请先绑定组织」误报
- 周日 cron 用 `0`（与常见五段 cron 一致）；月日无该日则该月不触发
- 测试备份不推进 `last_scheduled_at`，避免「测完当天定时不再跑」；有 pending/running 时拒绝并发
- 定时触发经 `dispatch_event`：若 broker 未 startup 须按需 `ensure_taskiq_broker_started`，禁止硬失败后仍 stamp `last_scheduled_at`
- `backup_type`：创建前查当前策略落点是否已有本组织 `status=success` 且 `backup_type=full`（本机或同 `storage_connection_uuid`）；无则 full，有则 incremental；与 `include_files` 无关
- 列表「备份类型」展示全量/增量，真源为记录的 `backup_type`

## 关联

- `features/data-backup-platform-all-tenants.md`
- `features/data-backup-stalled-reclaim.md`
- `features/scheduled-task-tenant-isolation-event.md`
