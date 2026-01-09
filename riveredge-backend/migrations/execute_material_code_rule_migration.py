"""
执行物料编码规则配置迁移

直接执行 21_20260108000000_add_material_code_rule_config.py 中的 SQL 语句来创建表结构。

Author: Luigi Lu
Date: 2026-01-08
"""

import asyncio
import asyncpg
import os
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

async def execute_migration():
    """执行迁移 SQL"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    
    try:
        print(f"📊 连接到数据库: {os.getenv('DB_NAME')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}")
        
        # 读取迁移文件
        migration_file = Path(__file__).parent / 'models' / '21_20260108000000_add_material_code_rule_config.py'
        
        if not migration_file.exists():
            print(f"❌ 迁移文件不存在: {migration_file}")
            return
        
        content = migration_file.read_text(encoding='utf-8')
        
        # 提取 upgrade 函数中的 SQL
        sql_match = re.search(r'async def upgrade.*?return """(.*?)"""', content, re.DOTALL)
        if not sql_match:
            print("❌ 无法从迁移文件中提取 SQL")
            return
        
        sql = sql_match.group(1).strip()
        
        # 分割成单独的语句（支持多行语句）
        statements = []
        current = []
        in_string = False
        string_char = None
        
        for line in sql.split('\n'):
            stripped = line.strip()
            if not stripped or stripped.startswith('--'):
                continue
            
            # 简单处理字符串中的分号（不分割字符串内的分号）
            for char in line:
                if char in ("'", '"') and (not current or current[-1] != '\\'):
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif char == string_char:
                        in_string = False
                        string_char = None
                
                current.append(char)
            
            # 如果行以分号结尾且不在字符串中，则结束语句
            if stripped.endswith(';') and not in_string:
                stmt = ''.join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
        
        # 添加最后一个语句（如果有）
        if current:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
        
        print(f"📝 共提取 {len(statements)} 条 SQL 语句")
        
        # 检查表是否已存在
        tables_to_create = [
            'core_material_code_rule_main',
            'core_material_type_config',
            'core_material_code_rule_alias',
            'core_material_code_rule_history',
            'core_material_sequence_counter',
        ]
        
        existing_tables = []
        for table_name in tables_to_create:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            """, table_name)
            if exists:
                existing_tables.append(table_name)
        
        if existing_tables:
            print(f"⚠️  以下表已存在: {', '.join(existing_tables)}")
            response = input("是否继续执行迁移？(y/n): ")
            if response.lower() != 'y':
                print("❌ 用户取消执行")
                return
        
        # 执行 SQL
        success_count = 0
        error_count = 0
        errors = []
        
        print("\n🚀 开始执行迁移...")
        async with conn.transaction():
            for i, stmt in enumerate(statements, 1):
                try:
                    await conn.execute(stmt)
                    success_count += 1
                    if i % 10 == 0:
                        print(f"   ✅ 已执行 {i}/{len(statements)} 条语句...")
                except Exception as e:
                    error_count += 1
                    error_msg = str(e)
                    errors.append((i, error_msg, stmt[:200]))
                    print(f"   ❌ 第 {i} 条语句执行失败: {error_msg}")
                    if error_count <= 3:
                        print(f"      语句: {stmt[:200]}...")
        
        # 验证表是否创建成功
        print("\n📊 验证表结构...")
        created_tables = []
        for table_name in tables_to_create:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            """, table_name)
            if exists:
                created_tables.append(table_name)
                # 检查列数量
                col_count = await conn.fetchval("""
                    SELECT COUNT(*) 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                """, table_name)
                print(f"   ✅ {table_name}: {col_count} 个字段")
        
        print(f"\n📊 执行结果:")
        print(f"   ✅ 成功: {success_count} 条语句")
        print(f"   ❌ 失败: {error_count} 条语句")
        print(f"   📋 创建表: {len(created_tables)}/{len(tables_to_create)}")
        
        if errors:
            print(f"\n❌ 错误详情（前5个）:")
            for i, err_msg, stmt in errors[:5]:
                print(f"   第 {i} 条: {err_msg[:80]}")
        
        if len(created_tables) == len(tables_to_create) and error_count == 0:
            print("\n✅ 迁移成功！所有表已创建")
        elif len(created_tables) > 0:
            print(f"\n⚠️  部分迁移成功，已创建 {len(created_tables)} 个表")
        else:
            print("\n❌ 迁移失败，请检查错误信息")
        
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(execute_migration())
