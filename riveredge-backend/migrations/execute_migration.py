"""
执行迁移文件中的 SQL

直接执行 0_init_schema.py 中的 SQL 语句来创建数据库结构。
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
        migration_file = Path(__file__).parent / 'models' / '0_init_schema.py'
        content = migration_file.read_text(encoding='utf-8')
        
        # 提取 SQL
        sql_match = re.search(r'return """(.*?)"""', content, re.DOTALL)
        if not sql_match:
            print("❌ 无法从迁移文件中提取 SQL")
            return
        
        sql = sql_match.group(1).strip()
        
        # 分割成单独的语句
        statements = []
        current = []
        for line in sql.split('\n'):
            line = line.strip()
            if not line or line.startswith('--'):
                continue
            current.append(line)
            if line.endswith(';'):
                stmt = ' '.join(current)
                if stmt:
                    statements.append(stmt)
                current = []
        
        print(f"📝 共提取 {len(statements)} 条 SQL 语句")
        
        # 执行前检查
        before = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        )
        print(f"📊 执行前表数量: {before}")
        
        # 执行 SQL
        success_count = 0
        error_count = 0
        errors = []
        
        async with conn.transaction():
            for i, stmt in enumerate(statements, 1):
                try:
                    await conn.execute(stmt)
                    success_count += 1
                    if i % 50 == 0:
                        print(f"   ✅ 已执行 {i}/{len(statements)} 条语句...")
                except Exception as e:
                    error_count += 1
                    error_msg = str(e)
                    errors.append((i, error_msg, stmt[:100]))
                    if error_count <= 5:
                        print(f"   ❌ 第 {i} 条语句执行失败: {error_msg[:80]}")
                        print(f"      语句: {stmt[:100]}...")
                    if error_count > 10:
                        print("   ⚠️  错误过多，停止执行")
                        break
        
        # 执行后检查
        after = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        )
        
        print(f"\n📊 执行后表数量: {after}")
        print(f"✅ 成功: {success_count}, ❌ 失败: {error_count}")
        
        if errors:
            print("\n❌ 错误详情:")
            for i, err_msg, stmt in errors[:10]:
                print(f"   第 {i} 条: {err_msg[:60]}")
        
        if after > before:
            print(f"\n✅ 迁移成功！新增 {after - before} 个表")
        elif error_count == 0:
            print("\n✅ 所有 SQL 语句执行完成（表可能已存在）")
        else:
            print("\n⚠️  迁移可能未完全成功，请检查错误信息")
        
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(execute_migration())

