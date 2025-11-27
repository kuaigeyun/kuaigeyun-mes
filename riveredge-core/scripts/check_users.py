"""
检查数据库中的用户

验证数据库是否已初始化，以及是否有测试用户
"""

import sys
import asyncio
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from core.database import DB_CONFIG
import asyncpg

async def check_users():
    """检查数据库中的用户"""
    try:
        print("=" * 60)
        print("检查数据库用户")
        print("=" * 60)
        print(f"数据库配置:")
        print(f"  HOST: {DB_CONFIG['host']}")
        print(f"  PORT: {DB_CONFIG['port']}")
        print(f"  USER: {DB_CONFIG['user']}")
        print(f"  DATABASE: {DB_CONFIG['database']}")
        print(f"  PASSWORD: {'*' * len(DB_CONFIG['password'])}")
        print()
        
        # 连接数据库
        print("正在连接数据库...")
        conn = await asyncpg.connect(**DB_CONFIG)
        print("✅ 数据库连接成功")
        print()
        
        # 检查表是否存在
        print("检查表是否存在...")
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'root_%' OR table_name LIKE 'tree_%' OR table_name LIKE 'core_%')
            ORDER BY table_name
        """)
        
        if tables:
            print(f"✅ 找到 {len(tables)} 个核心表:")
            for table in tables:
                print(f"   - {table['table_name']}")
        else:
            print("❌ 未找到核心表，数据库可能未初始化")
            print("   请运行: aerich init-db")
            await conn.close()
            return
        print()
        
        # 检查用户表
        print("检查用户表...")
        try:
            user_count = await conn.fetchval("SELECT COUNT(*) FROM root_users")
            print(f"✅ 用户表存在，共有 {user_count} 个用户")
            print()
            
            if user_count == 0:
                print("⚠️  警告: 数据库中没有用户")
                print("   请运行: python scripts/init_users.py")
            else:
                # 列出所有用户
                print("用户列表:")
                users = await conn.fetch("""
                    SELECT id, username, email, is_platform_admin, is_active, tenant_id
                    FROM root_users
                    ORDER BY id
                """)
                
                for user in users:
                    user_type = "平台管理员" if user.get('is_platform_admin') else "普通用户"
                    status = "激活" if user['is_active'] else "未激活"
                    tenant_info = f"组织ID: {user['tenant_id']}" if user['tenant_id'] else "无组织"
                    print(f"   [{user['id']}] {user['username']} ({user_type}, {status}, {tenant_info})")
                
                # 检查是否有超级管理员
                superadmin = await conn.fetchrow("""
                    SELECT id, username, is_active
                    FROM root_users
                    WHERE username = 'superadmin' AND is_platform_admin = true AND tenant_id IS NULL
                """)
                
                if superadmin:
                    print()
                    print(f"✅ 找到超级管理员: {superadmin['username']} (ID: {superadmin['id']}, 状态: {'激活' if superadmin['is_active'] else '未激活'})")
                else:
                    print()
                    print("⚠️  警告: 未找到超级管理员")
                    print("   请运行: python scripts/init_users.py")
        except Exception as e:
            print(f"❌ 查询用户表失败: {e}")
            import traceback
            traceback.print_exc()
        
        await conn.close()
        print()
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(check_users())

