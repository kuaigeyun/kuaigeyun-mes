"""
检查数据库中的表
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from app.config import settings
from core.database import DB_CONFIG
import asyncpg

async def check_tables():
    """检查数据库中的表"""
    try:
        print("=" * 60)
        print("检查数据库表")
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
        
        # 检查所有表
        print("检查所有表...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        
        if tables:
            print(f"✅ 找到 {len(tables)} 个表:")
            for table in tables:
                print(f"   - {table['table_name']}")
        else:
            print("❌ 未找到任何表，数据库可能未初始化")
        
        await conn.close()
        print()
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(check_tables())

