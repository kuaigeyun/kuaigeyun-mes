---
title: 应用连接器 RustFS 对象存储
slug: connector-storage-rustfs
status: delivered
domain: kuaiconnect
when: 改对象存储连接器、文件落点、备份落点；新增 S3 兼容存储类型
keywords:
  - rustfs
  - minio
  - 对象存储
  - application-connections
  - SUPPORTED_OBJECT_STORAGE_TYPES
standard: 连接器 type=rustfs + RustFsStorage（复用 MinIO SDK）+ SUPPORTED_OBJECT_STORAGE_TYPES
---

# 应用连接器 RustFS 对象存储

## 目标

应用连接器「存储」类支持 RustFS（S3 兼容），与 MinIO 同字段配置；文件存储与数据备份策略可选该连接。

## 何时读 / 禁止另起

- 何时读：加新的 S3 兼容对象存储；改文件/备份可用的连接类型白名单
- 禁止：为 RustFS 另写第二套 SDK；只改前端不改 `SUPPORTED_OBJECT_STORAGE_TYPES` / 连接测试

## 标准入口

| 层 | 标准 |
|----|------|
| FE 市场 | `connectors.tsx` type=`rustfs`（kuaiconnect + system 双树） |
| FE 表单 | `application-connections/list` case `minio`/`rustfs` 同表（双树） |
| FE 品牌 | `connectorBrandPresentation` + `assets/connectors/rustfs.svg` |
| BE 类型白名单 | `integration_type_spec` + `connector_definitions` |
| BE 连通测试 | `IntegrationConfigService._test_minio_endpoint(..., product_label=)` |
| BE 读写适配 | `RustFsStorage` → `MinioStorage`；`resolver.SUPPORTED_OBJECT_STORAGE_TYPES` |
| 文件设置 | `FileStorageSettingsModal` 拉取 `rustfs` 连接 |

## 关键文件

| 角色 | 路径 |
|------|------|
| 适配器 | `riveredge-backend/src/core/services/file/storage/rustfs_storage.py` |
| 解析 | `.../file/storage/resolver.py` |
| 测试 | `.../integration/integration_config_service.py` |
| FE 连接器 | `riveredge-frontend/src/apps/kuaiconnect/.../connectors.tsx` 与 `pages/system/.../connectors.tsx` |
| FE Logo | `riveredge-frontend/src/assets/connectors/rustfs.svg` |

## 扩展点

1. 再加 S3 兼容存储：复用 `MinioStorage` 子类 + 进 `SUPPORTED_OBJECT_STORAGE_TYPES` + 前端表单并入 minio/rustfs 分支
2. 配置字段保持与 minio 一致：`endpoint/access_key/secret_key/bucket/region/use_ssl/use_path_style`

## 踩坑

- Windows 后端默认无热重载，改 `resolver` / 连接测试后须重启 API
- 探测走 path-style `/{bucket}` HEAD，与 MinIO 相同；HTTPS 对纯 HTTP 会 WRONG_VERSION_NUMBER

## 关联

- `features/data-backup-policy-schedule-storage.md`
