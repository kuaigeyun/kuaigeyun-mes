# 归档脚本说明

本目录包含已过期或不再使用的脚本文件。

## 归档原因

### init_apps_simple.py
- **归档日期**: 2026-01-21
- **归档原因**: 使用 SQLite 数据库，但项目已迁移到 PostgreSQL
- **替代方案**: 使用 `scripts/init/init_apps.py`（支持 PostgreSQL）

### fix_sales_delivery_demand_id.sql
- **归档日期**: 2026-01-21
- **归档原因**: 已有对应的数据库迁移文件 `migrations/models/36_20260117000000_enhance_sales_delivery_models.py`
- **替代方案**: 使用 Aerich 迁移系统进行数据库结构变更

## 注意事项

1. 归档脚本仅供参考，不建议在生产环境使用
2. 如需使用归档脚本，请先检查是否有更新的替代方案
3. 归档脚本可能包含过时的配置或依赖
