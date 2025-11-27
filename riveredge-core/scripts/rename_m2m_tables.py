"""
重命名多对多关系表
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from core.database import DB_CONFIG
import asyncpg

async def rename_m2m_tables():
    """重命名多对多关系表"""
    try:
        print("=" * 60)
        print("重命名多对多关系表")
        print("=" * 60)
        
        # 连接数据库
        print("正在连接数据库...")
        conn = await asyncpg.connect(**DB_CONFIG)
        print("✅ 数据库连接成功")
        print()
        
        # 重命名多对多关系表
        print("重命名多对多关系表...")
        await conn.execute('ALTER TABLE IF EXISTS core_users_core_roles RENAME TO root_users_root_roles')
        print('✅ core_users_core_roles → root_users_root_roles')
        
        await conn.execute('ALTER TABLE IF EXISTS core_roles_core_permissions RENAME TO root_roles_root_permissions')
        print('✅ core_roles_core_permissions → root_roles_root_permissions')
        print()
        
        # 验证
        print("验证重命名结果...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'root_%' OR table_name LIKE 'tree_%')
            ORDER BY table_name
        """)
        
        print(f"✅ 找到 {len(tables)} 个重命名后的表:")
        for table in tables:
            print(f"   - {table['table_name']}")
        
        await conn.close()
        print()
        print("=" * 60)
        print("✅ 多对多关系表重命名完成")
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(rename_m2m_tables())

