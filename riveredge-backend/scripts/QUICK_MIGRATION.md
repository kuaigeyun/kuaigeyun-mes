# 快速执行数据库表重命名迁移

## 🚀 快速执行

### Windows (Git Bash)

```bash
# 设置密码环境变量
export PGPASSWORD=your_password

# 执行迁移
psql -h localhost -p 5432 -U postgres -d riveredge -f migrations/rename_tables_to_new_naming.sql
```

### Windows (PowerShell)

```powershell
# 设置密码环境变量
$env:PGPASSWORD="your_password"

# 执行迁移
psql -h localhost -p 5432 -U postgres -d riveredge -f migrations/rename_tables_to_new_naming.sql
```

### Linux/Mac

```bash
# 设置密码环境变量
export PGPASSWORD=your_password

# 执行迁移
psql -h localhost -p 5432 -U postgres -d riveredge -f migrations/rename_tables_to_new_naming.sql
```

## ⚠️ 执行前检查

1. **数据库已备份**
2. **数据库服务正在运行**
3. **确认数据库连接信息**：
   - 主机: localhost (或 127.0.0.1)
   - 端口: 5432
   - 用户: postgres
   - 数据库: riveredge
   - 密码: (需要提供)

## ✅ 执行后验证

```sql
-- 检查新表名
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'platform_%' OR table_name LIKE 'core_%');

-- 检查旧表名（应该返回 0）
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'soil_%' OR table_name LIKE 'root_%' OR table_name LIKE 'sys_%' OR table_name LIKE 'tree_%');
```

## 📝 迁移内容

- **44 个表**将重命名
- 使用事务执行，确保原子性
- 如果失败会自动回滚

