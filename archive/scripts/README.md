# 归档脚本说明

## 📋 归档概述

本目录包含已归档的脚本文件，这些脚本在新开发计划中不再需要，但保留作为历史参考。

## 📁 归档内容

### 旧应用相关脚本（4个）

1. **backup_disabled_app_records.py** - 备份已停用应用记录
   - 用途：备份已停用应用的数据表记录
   - 状态：已停用应用已删除，脚本已归档

2. **backup_disabled_app_tables.py** - 备份已停用应用数据表
   - 用途：备份已停用应用的数据表
   - 状态：数据表已备份，脚本已归档

3. **delete_disabled_apps.py** - 删除已停用应用
   - 用途：删除已停用应用的数据表和记录
   - 状态：应用已删除，脚本已归档

4. **README_disabled_app_backup.md** - 备份说明文档
   - 用途：说明已停用应用的数据表备份情况
   - 状态：文档已归档

### 迁移测试脚本（7个）

1. **test_migrated_apis.py** - 测试迁移后的API路由
2. **test_migrated_infra_routes.py** - 测试平台级API路由迁移
3. **test_migrated_api_calls.py** - 测试API路由实际调用
4. **test_migrated_routes_simple.py** - 测试路由注册（简化版）
5. **test_dependency_injection_in_routes.py** - 测试路由依赖注入
6. **test_infra_service_registry.py** - 测试平台级服务注册表
7. **test_service_registry.py** - 测试服务注册表

**状态：** 迁移已完成，测试脚本已归档

## 📅 归档时间

2025-12-27

## ⚠️ 注意事项

- 这些脚本已不再使用，但保留作为历史参考
- 如需恢复，可以从archive目录复制回scripts目录
- 不建议在生产环境中使用这些脚本

