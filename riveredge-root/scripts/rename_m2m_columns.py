"""
重命名多对多关系表的列名

更新 root_users_root_roles 和 root_roles_root_permissions 表的列名
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

async def rename_m2m_columns():
    """重命名多对多关系表的列名"""
    try:
        print("=" * 60)
        print("重命名多对多关系表的列名")
        print("=" * 60)
        
        # 连接数据库
        print("正在连接数据库...")
        conn = await asyncpg.connect(**DB_CONFIG)
        print("✅ 数据库连接成功")
        print()
        
        # 检查并重命名 root_users_root_roles 表的列
        print("检查 root_users_root_roles 表的列...")
        cols = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'root_users_root_roles'
            ORDER BY column_name
        """)
        print(f"当前列: {[col['column_name'] for col in cols]}")
        
        # 重命名 core_users_id → root_users_id
        if any(col['column_name'] == 'core_users_id' for col in cols):
            await conn.execute('ALTER TABLE root_users_root_roles RENAME COLUMN core_users_id TO root_users_id')
            print('✅ core_users_id → root_users_id')
        else:
            print('⚠️  core_users_id 列不存在或已重命名')
        
        # 检查并重命名 root_roles_root_permissions 表的列
        print("\n检查 root_roles_root_permissions 表的列...")
        cols = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'root_roles_root_permissions'
            ORDER BY column_name
        """)
        print(f"当前列: {[col['column_name'] for col in cols]}")
        
        # 重命名 core_roles_id → root_roles_id
        if any(col['column_name'] == 'core_roles_id' for col in cols):
            await conn.execute('ALTER TABLE root_roles_root_permissions RENAME COLUMN core_roles_id TO root_roles_id')
            print('✅ core_roles_id → root_roles_id')
        else:
            print('⚠️  core_roles_id 列不存在或已重命名')
        
        # 验证结果
        print("\n验证重命名结果...")
        cols = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'root_users_root_roles'
            ORDER BY column_name
        """)
        print(f"root_users_root_roles 表的列: {[col['column_name'] for col in cols]}")
        
        cols = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'root_roles_root_permissions'
            ORDER BY column_name
        """)
        print(f"root_roles_root_permissions 表的列: {[col['column_name'] for col in cols]}")
        
        await conn.close()
        print()
        print("=" * 60)
        print("✅ 多对多关系表列名重命名完成")
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(rename_m2m_columns())

