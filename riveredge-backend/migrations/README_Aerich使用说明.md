# Aerich 使用说明

**重要：** 由于 Aerich 工具的路径配置问题，必须使用特定的方式运行。

## ✅ 正确的运行方式

### 方式1：使用环境变量（推荐）

```bash
cd riveredge-backend

# 设置 PYTHONPATH 并运行
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich upgrade
```

### 方式2：使用 run_aerich.py 脚本

```bash
cd riveredge-backend
uv run python run_aerich.py upgrade
```

## 📋 常用命令

### 查看迁移历史
```bash
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich history
```

### 查看未应用的迁移
```bash
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich heads
```

### 生成新的迁移文件
```bash
export PYTHONPATH=$PWD:$PWD/src:$PYTHONPATH
uv run aerich migrate --name migration_name
```

## ⚠️ 注意事项

1. **必须从项目根目录运行**：`riveredge-backend/`
2. **必须设置 PYTHONPATH**：包含项目根目录和 `src` 目录
3. **Aerich 版本**：已固定到 `0.7.1`，避免 `0.9.2` 的格式检测问题
4. **严禁使用 SQL 直接迁移**：必须使用 Aerich 工具

## 🔧 已应用的迁移

以下迁移已成功应用：

- ✅ `2_20250101235959_add_primary_keys.py`
- ✅ `3_20250101000000_add_foreign_key_constraints.py`
- ✅ `4_20250101000000_add_composite_indexes.py`
- ✅ `5_20250101000000_add_kuaizhizao_foreign_keys.py`
- ✅ `6_20250101000000_drop_kuaizhizao_bom_tables.py`
- ✅ `7_20250101235960_cleanup_orphaned_records.py`
- ✅ `8_20250101000000_rename_sequences_to_match_tables.py`
- ✅ `9_20260103000000_allow_null_sales_order_id_in_deliveries.py`
- ✅ `10_20260115000000_add_work_order_operations_and_freeze_fields.py`（P0优先级）
- ✅ `11_20260115000001_add_launch_countdowns.py`（P0优先级）

## 📝 问题排查

如果遇到 "No module named 'migrations'" 错误：

1. 确保在项目根目录运行
2. 确保设置了正确的 PYTHONPATH
3. 使用 `run_aerich.py` 脚本作为备选方案

