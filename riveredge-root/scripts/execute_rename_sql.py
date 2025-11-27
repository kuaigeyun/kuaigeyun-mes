"""
执行数据库重命名 SQL 脚本
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from app.config import settings
from core.database import DB_CONFIG
import asyncpg

async def execute_rename():
    """执行数据库重命名 SQL"""
    try:
        print("=" * 60)
        print("执行数据库表重命名")
        print("=" * 60)
        print(f"数据库配置:")
        print(f"  HOST: {DB_CONFIG['host']}")
        print(f"  PORT: {DB_CONFIG['port']}")
        print(f"  USER: {DB_CONFIG['user']}")
        print(f"  DATABASE: {DB_CONFIG['database']}")
        print()
        
        # 连接数据库
        print("正在连接数据库...")
        conn = await asyncpg.connect(**DB_CONFIG)
        print("✅ 数据库连接成功")
        print()
        
        # 读取 SQL 脚本
        sql_file = Path(__file__).parent.parent.parent / "scripts" / "rename_database.sql"
        if not sql_file.exists():
            print(f"❌ SQL 脚本不存在: {sql_file}")
            await conn.close()
            return
        
        print(f"读取 SQL 脚本: {sql_file}")
        sql_content = sql_file.read_text(encoding='utf-8')
        
        # 提取 BEGIN 和 COMMIT 之间的 SQL
        begin_idx = sql_content.find("BEGIN;")
        commit_idx = sql_content.find("COMMIT;")
        
        if begin_idx == -1 or commit_idx == -1:
            print("❌ SQL 脚本格式错误：未找到 BEGIN 或 COMMIT")
            await conn.close()
            return
        
        sql_statements = sql_content[begin_idx + 6:commit_idx].strip()
        
        # 执行 SQL
        print("正在执行 SQL 脚本...")
        print()
        
        # 分割 SQL 语句（按分号分割，但保留 COMMENT 语句）
        statements = []
        current_statement = ""
        for line in sql_statements.split('\n'):
            line = line.strip()
            if not line or line.startswith('--'):
                continue
            current_statement += line + " "
            if line.endswith(';'):
                statements.append(current_statement.strip())
                current_statement = ""
        
        # 执行 SQL（不使用事务，因为有些表可能不存在）
        for i, statement in enumerate(statements, 1):
            if statement:
                try:
                    # 移除末尾的分号
                    statement = statement.rstrip(';').strip()
                    if not statement:
                        continue
                    print(f"[{i}/{len(statements)}] 执行: {statement[:60]}...")
                    await conn.execute(statement)
                    print(f"  ✅ 成功")
                except Exception as e:
                    error_msg = str(e)
                    # 如果是表不存在的错误，跳过
                    if "不存在" in error_msg or "does not exist" in error_msg.lower() or "IF EXISTS" in statement:
                        print(f"  ⚠️  跳过（表/索引不存在或已处理）")
                    else:
                        print(f"  ❌ 失败: {error_msg}")
                        # 对于非关键错误，继续执行
                        if "COMMENT" in statement:
                            print(f"  ⚠️  注释设置失败，继续执行...")
                        else:
                            raise
        
        print()
        print("✅ 数据库表重命名完成")
        
        # 验证重命名结果
        print()
        print("验证重命名结果...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'root_%' OR table_name LIKE 'tree_%' OR table_name LIKE 'core_%')
            ORDER BY table_name
        """)
        
        if tables:
            print(f"✅ 找到 {len(tables)} 个表:")
            for table in tables:
                print(f"   - {table['table_name']}")
        
        await conn.close()
        print()
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(execute_rename())

