# 归档脚本说明

本目录包含已过期或不再使用的脚本与报告，**仅供参考，不建议在生产环境使用**。

## 目录结构

- **backend/** - 原 `riveredge-backend/scripts/` 下的一次性/过期脚本
- **reports/** - 历史检查报告（菜单、工厂页面等一次性分析报告）
- 根目录 - 原项目根 `scripts/` 下的过期脚本（如 `init_apps_simple.py` 等）

## 归档原因概览

### 根目录（早期归档）
- `init_apps_simple.py` - 使用 SQLite，项目已用 PostgreSQL；替代：`scripts/init/init_apps.py`
- `fix_sales_delivery_demand_id.sql` - 已有对应 Aerich 迁移

### backend/（2026-02 整理）
- **debug_*** - 调试用脚本
- **merge_*** - 迁移/文件头合并等一次性操作
- **reset_migrations.py / recreate_aerich.py** - 迁移重置类，仅特殊恢复时用
- **fix_duplicate_headers.py / add_file_headers.py** - 一次性代码规范修复
- **check_***（菜单/表结构/规则等）** - 一次性审计脚本
- **fix_menu_sync / fix_kuaizhizao_menus 等** - 一次性菜单/字段修复
- **cleanup_* / clear_* / mock_*** - 环境清理或 mock 数据
- **update_*（菜单/模型状态等）** - 一次性更新脚本
- **migrate_demand_status、traceability、register_test_apps 等** - 已完成的一次性迁移或测试

### reports/
- 菜单显示、翻译、统一化等历史检查报告（一次性分析产出）

## 注意事项

1. 归档脚本可能依赖过时配置或表结构，使用前请核对当前代码与数据库。
2. 如需类似功能，优先使用当前项目中的 `scripts/` 与 `riveredge-backend/scripts/` 内保留脚本。
