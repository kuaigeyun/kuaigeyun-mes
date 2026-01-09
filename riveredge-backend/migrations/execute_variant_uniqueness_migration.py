"""
执行变体组合唯一性索引迁移

直接执行 SQL 迁移文件，添加物料变体组合唯一性索引。

Author: Luigi Lu
Date: 2026-01-09
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
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def execute_migration():
    """
    执行迁移：添加物料变体组合唯一性索引
    """
    print("=" * 60)
    print("开始执行变体组合唯一性索引迁移")
    print("=" * 60)
    
    # 读取迁移文件
    migration_file = Path(__file__).parent / "models" / "24_20260109000000_add_material_variant_uniqueness_index.py"
    
    if not migration_file.exists():
        print(f"❌ 迁移文件不存在: {migration_file}")
        return
    
    print(f"📄 读取迁移文件: {migration_file.name}")
    
    # 读取文件内容
    with open(migration_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 提取 upgrade 函数的 SQL
    import re
    # 查找 upgrade 函数的 return 语句中的 SQL
    match = re.search(r'async def upgrade.*?return\s+"""\s*(.*?)"""', content, re.DOTALL)
    if not match:
        print("❌ 无法从迁移文件中提取 SQL")
        return
    
    sql_statements = match.group(1).strip()
    
    # 分割 SQL 语句（按分号分割，但保留注释）
    # 移除注释行
    lines = sql_statements.split('\n')
    sql_lines = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith('--'):
            sql_lines.append(line)
    
    # 重新组合 SQL（按分号分割）
    full_sql = ' '.join(sql_lines)
    statements = [s.strip() + ';' for s in full_sql.split(';') if s.strip()]
    
    print(f"📊 找到 {len(statements)} 条 SQL 语句")
    
    # 连接数据库
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        print(f"✅ 数据库连接成功: {DB_NAME}@{DB_HOST}:{DB_PORT}")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return
    
    try:
        # 执行 SQL 语句
        for i, statement in enumerate(statements, 1):
            if not statement.strip() or statement.strip() == ';':
                continue
            
            print(f"\n[{i}/{len(statements)}] 执行 SQL 语句...")
            print(f"SQL: {statement[:100]}..." if len(statement) > 100 else f"SQL: {statement}")
            
            try:
                await conn.execute(statement)
                print(f"✅ 执行成功")
            except Exception as e:
                # 如果是索引已存在的错误，忽略
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"⚠️  索引已存在，跳过: {e}")
                else:
                    print(f"❌ 执行失败: {e}")
                    raise
        
        print("\n" + "=" * 60)
        print("✅ 迁移执行完成")
        print("=" * 60)
        
        # 验证索引是否创建成功
        print("\n验证索引创建情况...")
        indexes = await conn.fetch("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'apps_master_data_materials'
            AND indexname IN (
                'uid_material_variant_combination',
                'idx_material_variants_by_main_code',
                'idx_material_master_by_main_code'
            )
            ORDER BY indexname;
        """)
        
        if indexes:
            print(f"✅ 找到 {len(indexes)} 个索引:")
            for idx in indexes:
                print(f"   - {idx['indexname']}")
        else:
            print("⚠️  未找到预期的索引，请检查迁移是否成功")
        
    except Exception as e:
        print(f"\n❌ 迁移执行失败: {e}")
        raise
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
