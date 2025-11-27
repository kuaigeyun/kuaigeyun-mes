"""
创建保存搜索条件表的脚本

直接执行 SQL 创建表结构
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.database import DB_CONFIG
import asyncpg


async def create_table():
    """创建保存搜索条件表"""
    try:
        # 读取 SQL 文件
        sql_file = Path(__file__).parent / "create_saved_search_table.sql"
        with open(sql_file, "r", encoding="utf-8") as f:
            sql = f.read()
        
        # 连接数据库
        print("正在连接数据库...")
        conn = await asyncpg.connect(**DB_CONFIG)
        print("✓ 数据库连接成功")
        
        # 执行 SQL
        print("正在创建表结构...")
        await conn.execute(sql)
        print("✓ 表结构创建成功")
        
        # 验证表是否存在
        table_exists = await conn.fetchval(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'root_saved_searches')"
        )
        
        if table_exists:
            print("✓ root_saved_searches 表已存在")
        else:
            print("✗ root_saved_searches 表创建失败")
        
        # 关闭连接
        await conn.close()
        print("✓ 数据库连接已关闭")
        
    except Exception as e:
        print(f"✗ 操作失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(create_table())

