# 数据库迁移初始化指南

## 概述

本文档说明如何基于当前数据库状态（`public.sql`）重新初始化 Aerich 迁移文件。

## 当前状态

- **数据库结构文件**: `migrations/models/public.sql` (已导出，包含128个表)
- **现有迁移文件**: 57个迁移文件（可能存在版本号不连续或重复）
- **Aerich 配置**: 已配置在 `pyproject.toml` 和 `migrations/aerich_config.py`

## 问题分析

### 1. 迁移链条检查

运行检查脚本：
```bash
cd riveredge-backend
python migrations/check_migration_chain.py
```

这将检查：
- 迁移文件版本号是否连续
- 是否有重复版本号
- 迁移文件是否完整（包含 upgrade 函数）

### 2. 当前数据库表结构

从 `public.sql` 中提取的表（共128个）：
- `aerich` - Aerich 迁移记录表
- `core_*` - 系统级表（约50个）
- `infra_*` - 平台级表（约10个）
- `apps_master_data_*` - 主数据管理应用表（约20个）
- 其他应用表

## 初始化方案

### 方案A：基于当前数据库状态初始化（推荐）

适用于：数据库已有完整表结构，需要重新建立迁移链条。

#### 步骤1：备份现有迁移文件

```bash
cd riveredge-backend
./migrations/init_from_current_db.sh
```

这将：
- 备份现有迁移文件到 `migrations/backup_YYYYMMDD_HHMMSS/`
- 清理现有迁移文件（保留 `public.sql`）

#### 步骤2：确保数据库连接正常

检查 `.env` 文件中的数据库配置：
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=riveredge
```

#### 步骤3：导入数据库结构（如果尚未导入）

如果数据库是空的，先导入 `public.sql`：
```bash
psql -U your_user -d riveredge -f migrations/models/public.sql
```

#### 步骤4：初始化 Aerich

```bash
cd riveredge-backend

# 如果 Aerich 尚未初始化
uv run aerich init-db

# 如果 Aerich 已初始化，但需要重新开始
# 先删除 aerich 表（如果存在）
psql -U your_user -d riveredge -c "DROP TABLE IF EXISTS aerich;"

# 然后重新初始化
uv run aerich init-db
```

#### 步骤5：创建初始迁移（标记当前状态）

如果数据库已有表结构，创建一个空迁移来标记当前状态：

```bash
# 创建空迁移
uv run aerich migrate --name init_from_current_db

# 手动编辑生成的迁移文件，确保它不执行任何操作
# 或者直接标记为已应用（如果表结构已存在）
```

#### 步骤6：验证迁移状态

```bash
# 查看迁移历史
uv run aerich history

# 查看当前迁移头
uv run aerich heads

# 检查迁移状态
uv run aerich status
```

### 方案B：从零开始初始化

适用于：数据库是空的，需要从头创建表结构。

#### 步骤1：清理现有迁移

```bash
cd riveredge-backend
./migrations/init_from_current_db.sh
```

#### 步骤2：初始化 Aerich

```bash
uv run aerich init-db
```

这将：
- 基于当前模型定义生成初始迁移文件
- 创建所有表结构

#### 步骤3：应用迁移

```bash
uv run aerich upgrade
```

## 迁移文件命名规范

Aerich 生成的迁移文件命名格式：
```
{version}_{timestamp}_{name}.py
```

例如：
- `0_20251227_123456_init_from_current_db.py`

## 注意事项

1. **备份数据库**: 在执行任何迁移操作前，请先备份数据库
2. **版本控制**: 迁移文件应该提交到 Git，但不要手动修改已应用的迁移
3. **环境一致性**: 确保开发、测试、生产环境的迁移文件一致
4. **模型定义**: 确保 `TORTOISE_ORM` 配置中的模型路径正确

## 常见问题

### Q1: 迁移文件版本号不连续怎么办？

**A**: 运行 `check_migration_chain.py` 检查，然后：
- 如果有缺失版本，可以手动创建空迁移补全
- 如果有重复版本，删除重复的迁移文件

### Q2: 数据库已有表结构，但 Aerich 认为需要迁移怎么办？

**A**: 
1. 先运行 `aerich migrate --name init_from_current_db` 创建空迁移
2. 手动编辑迁移文件，移除所有 SQL 操作
3. 运行 `aerich upgrade` 标记为已应用

### Q3: 如何重置迁移链条？

**A**:
```bash
# 1. 备份数据库
pg_dump -U your_user -d riveredge > backup.sql

# 2. 删除 aerich 表
psql -U your_user -d riveredge -c "DROP TABLE IF EXISTS aerich;"

# 3. 清理迁移文件
rm migrations/models/*.py  # 保留 __init__.py 和 public.sql

# 4. 重新初始化
uv run aerich init-db
```

## 相关文件

- `migrations/aerich_config.py` - Aerich 配置文件
- `migrations/models/public.sql` - 当前数据库结构导出
- `migrations/check_migration_chain.py` - 迁移链条检查脚本
- `migrations/init_from_current_db.sh` - 初始化脚本
- `src/infra/infrastructure/database/database.py` - Tortoise ORM 配置

## 参考文档

- [Aerich 官方文档](https://github.com/tortoise/aerich)
- [Tortoise ORM 文档](https://tortoise.github.io/)

