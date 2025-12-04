#!/usr/bin/env python3
"""
生成索引和约束重命名 SQL 脚本
从数据库查询需要重命名的索引和约束，生成 ALTER 语句
"""

import sys
import asyncio
import asyncpg
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "riveredge-backend" / "src"))

try:
    from platform.config.platform_config import platform_settings as settings
except ImportError:
    # 如果无法导入，使用环境变量
    import os
    settings = None
    db_config = {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "postgres"),
        "database": os.getenv("DB_NAME", "riveredge"),
    }
else:
    db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST
    db_config = {
        "host": db_host,
        "port": settings.DB_PORT,
        "user": settings.DB_USER,
        "password": settings.DB_PASSWORD,
        "database": settings.DB_NAME,
    }


async def generate_rename_sql():
    """生成重命名 SQL 脚本"""
    try:
        # 连接数据库
        conn = await asyncpg.connect(**db_config)
        
        print("=" * 60)
        print("🔍 查询需要重命名的索引和约束")
        print("=" * 60)
        
        sql_statements = []
        
        # 1. 查询索引
        print("\n📋 查询索引...")
        indexes = await conn.fetch("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                CASE 
                    WHEN indexname LIKE 'idx_soil_%' THEN REPLACE(indexname, 'idx_soil_', 'idx_platform_')
                    WHEN indexname LIKE 'idx_root_%' THEN REPLACE(indexname, 'idx_root_', 'idx_core_')
                    WHEN indexname LIKE 'idx_sys_%' THEN REPLACE(indexname, 'idx_sys_', 'idx_core_')
                    WHEN indexname LIKE 'idx_tree_%' THEN REPLACE(indexname, 'idx_tree_', 'idx_platform_')
                    WHEN indexname LIKE 'uk_soil_%' THEN REPLACE(indexname, 'uk_soil_', 'uk_platform_')
                    WHEN indexname LIKE 'uk_root_%' THEN REPLACE(indexname, 'uk_root_', 'uk_core_')
                    WHEN indexname LIKE 'uk_sys_%' THEN REPLACE(indexname, 'uk_sys_', 'uk_core_')
                    WHEN indexname LIKE 'uk_tree_%' THEN REPLACE(indexname, 'uk_tree_', 'uk_platform_')
                    WHEN indexname LIKE 'pk_soil_%' THEN REPLACE(indexname, 'pk_soil_', 'pk_platform_')
                    WHEN indexname LIKE 'pk_root_%' THEN REPLACE(indexname, 'pk_root_', 'pk_core_')
                    WHEN indexname LIKE 'pk_sys_%' THEN REPLACE(indexname, 'pk_sys_', 'pk_core_')
                    WHEN indexname LIKE 'pk_tree_%' THEN REPLACE(indexname, 'pk_tree_', 'pk_platform_')
                END as new_indexname
            FROM pg_indexes 
            WHERE schemaname = 'public' 
              AND (
                indexname LIKE 'idx_soil_%' OR 
                indexname LIKE 'idx_root_%' OR 
                indexname LIKE 'idx_sys_%' OR 
                indexname LIKE 'idx_tree_%' OR
                indexname LIKE 'uk_soil_%' OR 
                indexname LIKE 'uk_root_%' OR 
                indexname LIKE 'uk_sys_%' OR 
                indexname LIKE 'uk_tree_%' OR
                indexname LIKE 'pk_soil_%' OR 
                indexname LIKE 'pk_root_%' OR 
                indexname LIKE 'pk_sys_%' OR 
                indexname LIKE 'pk_tree_%'
              )
            ORDER BY tablename, indexname
        """)
        
        if indexes:
            sql_statements.append("-- ============================================")
            sql_statements.append("-- 重命名索引")
            sql_statements.append("-- ============================================")
            for idx in indexes:
                sql_statements.append(f'ALTER INDEX IF EXISTS "{idx["indexname"]}" RENAME TO "{idx["new_indexname"]}";')
            print(f"✅ 找到 {len(indexes)} 个需要重命名的索引")
        else:
            print("ℹ️  没有找到需要重命名的索引")
        
        # 2. 查询外键约束
        print("\n📋 查询外键约束...")
        fk_constraints = await conn.fetch("""
            SELECT 
                conname as constraint_name,
                conrelid::regclass::text as table_name,
                CASE 
                    WHEN conname LIKE '%_soil_%' THEN REPLACE(REPLACE(REPLACE(conname, '_soil_', '_platform_'), 'fk_soil_', 'fk_platform_'), 'uk_soil_', 'uk_platform_')
                    WHEN conname LIKE '%_root_%' THEN REPLACE(REPLACE(REPLACE(conname, '_root_', '_core_'), 'fk_root_', 'fk_core_'), 'uk_root_', 'uk_core_')
                    WHEN conname LIKE '%_sys_%' THEN REPLACE(REPLACE(REPLACE(conname, '_sys_', '_core_'), 'fk_sys_', 'fk_core_'), 'uk_sys_', 'uk_core_')
                    WHEN conname LIKE '%_tree_%' THEN REPLACE(REPLACE(REPLACE(conname, '_tree_', '_platform_'), 'fk_tree_', 'fk_platform_'), 'uk_tree_', 'uk_platform_')
                END as new_constraint_name
            FROM pg_constraint
            WHERE contype = 'f'
              AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
              AND (
                conname LIKE '%_soil_%' OR 
                conname LIKE '%_root_%' OR 
                conname LIKE '%_sys_%' OR 
                conname LIKE '%_tree_%'
              )
            ORDER BY conrelid::regclass::text, conname
        """)
        
        if fk_constraints:
            sql_statements.append("")
            sql_statements.append("-- ============================================")
            sql_statements.append("-- 重命名外键约束")
            sql_statements.append("-- ============================================")
            for fk in fk_constraints:
                sql_statements.append(f'ALTER TABLE "{fk["table_name"]}" RENAME CONSTRAINT "{fk["constraint_name"]}" TO "{fk["new_constraint_name"]}";')
            print(f"✅ 找到 {len(fk_constraints)} 个需要重命名的外键约束")
        else:
            print("ℹ️  没有找到需要重命名的外键约束")
        
        # 3. 查询唯一约束
        print("\n📋 查询唯一约束...")
        unique_constraints = await conn.fetch("""
            SELECT 
                conname as constraint_name,
                conrelid::regclass::text as table_name,
                CASE 
                    WHEN conname LIKE '%_soil_%' THEN REPLACE(conname, '_soil_', '_platform_')
                    WHEN conname LIKE '%_root_%' THEN REPLACE(conname, '_root_', '_core_')
                    WHEN conname LIKE '%_sys_%' THEN REPLACE(conname, '_sys_', '_core_')
                    WHEN conname LIKE '%_tree_%' THEN REPLACE(conname, '_tree_', '_platform_')
                END as new_constraint_name
            FROM pg_constraint
            WHERE contype = 'u'
              AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
              AND (
                conname LIKE '%_soil_%' OR 
                conname LIKE '%_root_%' OR 
                conname LIKE '%_sys_%' OR 
                conname LIKE '%_tree_%'
              )
            ORDER BY conrelid::regclass::text, conname
        """)
        
        if unique_constraints:
            sql_statements.append("")
            sql_statements.append("-- ============================================")
            sql_statements.append("-- 重命名唯一约束")
            sql_statements.append("-- ============================================")
            for uk in unique_constraints:
                sql_statements.append(f'ALTER TABLE "{uk["table_name"]}" RENAME CONSTRAINT "{uk["constraint_name"]}" TO "{uk["new_constraint_name"]}";')
            print(f"✅ 找到 {len(unique_constraints)} 个需要重命名的唯一约束")
        else:
            print("ℹ️  没有找到需要重命名的唯一约束")
        
        # 4. 查询检查约束
        print("\n📋 查询检查约束...")
        check_constraints = await conn.fetch("""
            SELECT 
                conname as constraint_name,
                conrelid::regclass::text as table_name,
                CASE 
                    WHEN conname LIKE '%_soil_%' THEN REPLACE(conname, '_soil_', '_platform_')
                    WHEN conname LIKE '%_root_%' THEN REPLACE(conname, '_root_', '_core_')
                    WHEN conname LIKE '%_sys_%' THEN REPLACE(conname, '_sys_', '_core_')
                    WHEN conname LIKE '%_tree_%' THEN REPLACE(conname, '_tree_', '_platform_')
                END as new_constraint_name
            FROM pg_constraint
            WHERE contype = 'c'
              AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
              AND (
                conname LIKE '%_soil_%' OR 
                conname LIKE '%_root_%' OR 
                conname LIKE '%_sys_%' OR 
                conname LIKE '%_tree_%'
              )
            ORDER BY conrelid::regclass::text, conname
        """)
        
        if check_constraints:
            sql_statements.append("")
            sql_statements.append("-- ============================================")
            sql_statements.append("-- 重命名检查约束")
            sql_statements.append("-- ============================================")
            for ck in check_constraints:
                sql_statements.append(f'ALTER TABLE "{ck["table_name"]}" RENAME CONSTRAINT "{ck["constraint_name"]}" TO "{ck["new_constraint_name"]}";')
            print(f"✅ 找到 {len(check_constraints)} 个需要重命名的检查约束")
        else:
            print("ℹ️  没有找到需要重命名的检查约束")
        
        await conn.close()
        
        # 生成 SQL 文件
        if sql_statements:
            sql_content = "\n".join([
                "-- 索引和约束重命名脚本",
                "-- 从植物系命名重构为常规B端命名",
                "-- 生成时间: 2025-01-04",
                "",
                "BEGIN;",
                ""
            ] + sql_statements + [
                "",
                "COMMIT;"
            ])
            
            output_file = project_root / "migrations" / "rename_indexes_and_constraints.sql"
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(sql_content, encoding='utf-8')
            
            print("\n" + "=" * 60)
            print(f"✅ SQL 脚本已生成: {output_file}")
            print(f"📊 总计: {len(indexes)} 个索引, {len(fk_constraints)} 个外键, {len(unique_constraints)} 个唯一约束, {len(check_constraints)} 个检查约束")
            print("=" * 60)
        else:
            print("\n⚠️  没有找到需要重命名的索引或约束")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(generate_rename_sql())

