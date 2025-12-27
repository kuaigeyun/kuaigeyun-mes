# 数据库迁移使用指南

## 概述

本文档说明如何使用迁移工具和迁移文件管理数据库结构。

## 工具脚本

### 1. 生成迁移文件工具

**`generate_migration_from_sql.py`** - 从 public.sql 生成 Aerich 迁移文件

```bash
cd riveredge-backend

# 自动查找 public.sql 并生成迁移文件
python migrations/generate_migration_from_sql.py

# 指定 SQL 文件路径
python migrations/generate_migration_from_sql.py path/to/public.sql

# 指定输出文件名
python migrations/generate_migration_from_sql.py public.sql -o 0_init_schema.py
```

**功能**：
- 解析 public.sql 文件
- 提取 CREATE TABLE, CREATE SEQUENCE, CREATE INDEX, COMMENT 语句
- 自动添加 IF NOT EXISTS 避免重复执行
- 生成符合 Aerich 格式的迁移文件

### 2. 手动应用迁移工具

**`apply_migration_manually.py`** - 手动将迁移记录插入 aerich 表

```bash
cd riveredge-backend
python migrations/apply_migration_manually.py
```

**用途**：当 Aerich 出现兼容性问题时，手动插入迁移记录。

## 迁移文件

### 当前迁移文件

- **`models/0_init_schema.py`** - 完整的数据库结构迁移文件
  - 包含所有表、序列、索引和注释
  - 从 `public.sql` 自动生成
  - 适用于新环境部署

- **`models/public.sql`** - 数据库结构 SQL 文件
  - 用于生成迁移文件
  - 包含完整的数据库结构定义

## 使用流程

### 新环境部署

1. **生成迁移文件**（如果还没有）：
```bash
cd riveredge-backend
python migrations/generate_migration_from_sql.py migrations/models/public.sql -o 0_init_schema.py
```

2. **应用迁移**（选择一种方式）：

**方式A：使用 Aerich（推荐）**
```bash
uv run aerich upgrade
```

**方式B：手动应用迁移记录**
```bash
python migrations/apply_migration_manually.py
```

**方式C：直接执行 SQL**（不推荐，但可以作为备选）
```bash
psql -U your_user -d your_db -f migrations/models/public.sql
```

### 现有环境更新

如果数据库已经存在，只需要确保迁移记录已应用：

```bash
# 检查迁移记录
python migrations/apply_migration_manually.py

# 或使用 Aerich
uv run aerich upgrade
```

## 注意事项

1. **迁移文件命名**：迁移文件必须以数字前缀开头（如 `0_`, `1_`），Aerich 会根据数字顺序执行
2. **IF NOT EXISTS**：所有 CREATE 语句都包含 `IF NOT EXISTS`，可以安全地重复执行
3. **事务支持**：迁移文件设置了 `RUN_IN_TRANSACTION = True`，确保原子性
4. **备份**：在生产环境执行迁移前，请先备份数据库

## 历史记录

- 2025-12-27: 创建初始迁移文件生成工具
- 2025-12-27: 修复重复 IF NOT EXISTS 的 bug
- 2025-12-27: 清理过程性脚本，保留最终有效工具

## 旧版初始化流程（已废弃）

以下流程已废弃，保留仅作参考：

#### 步骤1：备份现有迁移文件

```bash
cd riveredge-backend
# 旧版脚本已删除，请使用新的 generate_migration_from_sql.py
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

