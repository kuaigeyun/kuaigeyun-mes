"""
执行物料默认值和外部实体字段迁移

手动执行迁移文件：22_20260108000001_add_material_defaults_and_external_entity_fields.py

Author: Luigi Lu
Date: 2026-01-08
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库连接配置
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def execute_migration():
    """执行迁移"""
    # 读取迁移文件
    migration_file = Path(__file__).parent / "models" / "22_20260108000001_add_material_defaults_and_external_entity_fields.py"
    
    if not migration_file.exists():
        print(f"错误：迁移文件不存在: {migration_file}")
        return
    
    print(f"读取迁移文件: {migration_file}")
    
    # 读取文件内容
    with open(migration_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取upgrade函数的SQL
    import re
    match = re.search(r'async def upgrade.*?return """(.*?)"""', content, re.DOTALL)
    if not match:
        print("错误：无法提取upgrade SQL")
        return
    
    sql_content = match.group(1).strip()
    
    # 分割SQL语句（按分号分割，但要注意字符串中的分号）
    # 简单处理：按行分割，然后合并
    statements = []
    current_statement = []
    
    for line in sql_content.split('\n'):
        line = line.strip()
        if not line or line.startswith('--'):
            continue
        
        current_statement.append(line)
        
        # 如果行以分号结尾，说明是一个完整的语句
        if line.rstrip().endswith(';'):
            statement = ' '.join(current_statement)
            if statement:
                statements.append(statement)
            current_statement = []
    
    # 连接数据库
    print(f"\n连接数据库: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print("数据库连接成功\n")
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return
    
    try:
        # 开始事务
        async with conn.transaction():
            print("开始执行迁移...")
            print(f"共 {len(statements)} 条SQL语句\n")
            
            for i, statement in enumerate(statements, 1):
                print(f"[{i}/{len(statements)}] 执行SQL...")
                try:
                    await conn.execute(statement)
                    print(f"  ✓ 成功")
                except Exception as e:
                    print(f"  ✗ 失败: {e}")
                    # 如果是字段已存在的错误，可以忽略
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        print(f"  ⚠ 字段可能已存在，跳过")
                    else:
                        raise
            
            print("\n迁移执行完成！")
            
            # 验证表结构
            print("\n验证表结构...")
            
            # 检查物料表的defaults字段
            material_columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_materials' 
                AND column_name = 'defaults'
            """)
            if material_columns:
                print("  ✓ apps_master_data_materials.defaults 字段存在")
            else:
                print("  ✗ apps_master_data_materials.defaults 字段不存在")
            
            # 检查编码别名表的外部实体字段
            alias_columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_material_code_aliases' 
                AND column_name IN ('external_entity_type', 'external_entity_id')
            """)
            if len(alias_columns) == 2:
                print("  ✓ apps_master_data_material_code_aliases.external_entity_type 字段存在")
                print("  ✓ apps_master_data_material_code_aliases.external_entity_id 字段存在")
            else:
                print(f"  ✗ 编码别名表的外部实体字段不完整（找到 {len(alias_columns)} 个字段）")
            
            # 检查索引
            indexes = await conn.fetch("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'apps_master_data_material_code_aliases' 
                AND indexname = 'idx_material_code_alias_external_entity'
            """)
            if indexes:
                print("  ✓ 外部实体索引存在")
            else:
                print("  ⚠ 外部实体索引不存在（可能已存在或创建失败）")
            
    except Exception as e:
        print(f"\n迁移执行失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
