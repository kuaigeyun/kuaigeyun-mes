"""
执行变体属性定义迁移

手动执行迁移文件：23_20260108000002_add_material_variant_attribute_definitions.py

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
    migration_file = Path(__file__).parent / "models" / "23_20260108000002_add_material_variant_attribute_definitions.py"
    
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
                        print(f"  ⚠ 对象可能已存在，跳过")
                    else:
                        raise
            
            print("\n迁移执行完成！")
            
            # 验证表结构
            print("\n验证表结构...")
            
            # 检查变体属性定义表
            definition_columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'core_material_variant_attribute_definitions' 
                AND column_name IN ('attribute_name', 'attribute_type', 'display_name', 'enum_values', 'validation_rules')
            """)
            if len(definition_columns) >= 5:
                print("  ✓ core_material_variant_attribute_definitions 表存在且字段完整")
            else:
                print(f"  ✗ 变体属性定义表字段不完整（找到 {len(definition_columns)} 个字段）")
            
            # 检查版本历史表
            history_columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'core_material_variant_attribute_history' 
                AND column_name IN ('attribute_definition_id', 'version', 'attribute_config')
            """)
            if len(history_columns) >= 3:
                print("  ✓ core_material_variant_attribute_history 表存在且字段完整")
            else:
                print(f"  ✗ 版本历史表字段不完整（找到 {len(history_columns)} 个字段）")
            
    except Exception as e:
        print(f"\n迁移执行失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
