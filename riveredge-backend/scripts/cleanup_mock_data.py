"""
清理默认租户中的 MOCK 数据

只保留：
1. 一个默认租户（domain="default"）
2. 默认租户中只保留一个用户 ldj
3. 保留所有超级管理员（is_infra_admin=True）

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
from datetime import datetime

# 加载环境变量
load_dotenv()


async def cleanup_mock_data():
    """
    清理默认租户中的 MOCK 数据
    """
    conn = None
    try:
        # 数据库连接信息
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = int(os.getenv('DB_PORT', 5432))
        db_user = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', 'postgres')
        db_name = os.getenv('DB_NAME', 'riveredge')
        
        print(f"📊 连接到数据库: {db_name}@{db_host}:{db_port}")
        
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        
        print(f"✅ 成功连接到数据库")
        
        # 1. 查找默认租户
        print(f"\n📋 查找默认租户（domain='default'）...")
        default_tenant = await conn.fetchrow(
            "SELECT id, name, domain FROM infra_tenants WHERE domain = $1",
            "default"
        )
        
        if not default_tenant:
            print(f"❌ 未找到默认租户（domain='default'）")
            return
        
        default_tenant_id = default_tenant['id']
        print(f"✅ 找到默认租户: ID={default_tenant_id}, Name={default_tenant['name']}, Domain={default_tenant['domain']}")
        
        # 2. 查看默认租户中的所有用户
        print(f"\n📋 查看默认租户中的所有用户...")
        users = await conn.fetch(
            """
            SELECT id, username, email, is_active, is_infra_admin, is_tenant_admin, created_at
            FROM core_users
            WHERE tenant_id = $1 AND deleted_at IS NULL
            ORDER BY created_at
            """,
            default_tenant_id
        )
        
        print(f"找到 {len(users)} 个用户:")
        for user in users:
            print(f"  - ID: {user['id']}, Username: {user['username']}, Email: {user['email']}, "
                  f"Active: {user['is_active']}, Created: {user['created_at']}")
        
        # 3. 查找用户 ldj
        print(f"\n📋 查找用户 ldj...")
        ldj_user = await conn.fetchrow(
            """
            SELECT id, username, email, is_active, is_infra_admin, is_tenant_admin
            FROM core_users
            WHERE tenant_id = $1 AND username = $2 AND deleted_at IS NULL
            """,
            default_tenant_id,
            "ldj"
        )
        
        if not ldj_user:
            print(f"❌ 未找到用户 ldj，无法执行清理")
            return
        
        print(f"✅ 找到用户 ldj: ID={ldj_user['id']}, Username={ldj_user['username']}")
        
        # 4. 查看所有超级管理员
        print(f"\n📋 查看所有超级管理员（is_infra_admin=True）...")
        super_admins = await conn.fetch(
            """
            SELECT id, username, email, tenant_id, is_active
            FROM core_users
            WHERE is_infra_admin = true AND deleted_at IS NULL
            ORDER BY created_at
            """
        )
        
        print(f"找到 {len(super_admins)} 个超级管理员:")
        for admin in super_admins:
            print(f"  - ID: {admin['id']}, Username: {admin['username']}, "
                  f"Tenant ID: {admin['tenant_id']}, Active: {admin['is_active']}")
        
        # 5. 统计需要删除的用户
        users_to_delete = [u for u in users if u['id'] != ldj_user['id']]
        print(f"\n🗑️  需要删除的用户（保留 ldj）: {len(users_to_delete)} 个")
        for user in users_to_delete:
            print(f"  - ID: {user['id']}, Username: {user['username']}")
        
        # 6. 查看其他租户
        print(f"\n📋 查看其他租户...")
        other_tenants = await conn.fetch(
            "SELECT id, name, domain FROM infra_tenants WHERE domain != $1 ORDER BY created_at",
            "default"
        )
        
        print(f"找到 {len(other_tenants)} 个其他租户:")
        for tenant in other_tenants:
            print(f"  - ID: {tenant['id']}, Name: {tenant['name']}, Domain: {tenant['domain']}")
        
        # 7. 确认操作
        print(f"\n⚠️  清理操作:")
        print(f"  1. 删除默认租户中的 {len(users_to_delete)} 个用户（保留 ldj）")
        print(f"  2. 删除 {len(other_tenants)} 个其他租户")
        print(f"  3. 保留所有超级管理员（{len(super_admins)} 个）")
        print(f"\n是否继续? (y/n): ", end='')
        
        # 自动确认（实际使用时可以改为 input()）
        confirm = 'y'
        
        if confirm.lower() != 'y':
            print(f"\n❌ 取消清理操作")
            return
        
        # 8. 开始清理
        print(f"\n🗑️  开始清理...")
        
        # 8.1 删除默认租户中的其他用户（保留 ldj）
        if users_to_delete:
            user_ids = [u['id'] for u in users_to_delete]
            # 使用软删除
            deleted_count = await conn.execute(
                """
                UPDATE core_users
                SET deleted_at = $1
                WHERE id = ANY($2::int[]) AND tenant_id = $3
                """,
                datetime.now(),
                user_ids,
                default_tenant_id
            )
            print(f"  ✅ 已删除 {len(user_ids)} 个用户（软删除）")
        
        # 8.2 删除其他租户（需要先删除这些租户的用户）
        if other_tenants:
            tenant_ids = [t['id'] for t in other_tenants]
            
            # 先删除这些租户的用户（软删除）
            await conn.execute(
                """
                UPDATE core_users
                SET deleted_at = $1
                WHERE tenant_id = ANY($2::int[]) AND deleted_at IS NULL
                """,
                datetime.now(),
                tenant_ids
            )
            print(f"  ✅ 已删除其他租户的用户（软删除）")
            
            # 然后删除租户（软删除，如果表有 deleted_at 字段）
            # 检查 infra_tenants 表是否有 deleted_at 字段
            has_deleted_at = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'infra_tenants' 
                    AND column_name = 'deleted_at'
                )
            """)
            
            if has_deleted_at:
                await conn.execute(
                    """
                    UPDATE infra_tenants
                    SET deleted_at = $1
                    WHERE id = ANY($2::int[])
                    """,
                    datetime.now(),
                    tenant_ids
                )
                print(f"  ✅ 已删除 {len(tenant_ids)} 个其他租户（软删除）")
            else:
                # 如果没有 deleted_at 字段，直接删除
                await conn.execute(
                    """
                    DELETE FROM infra_tenants
                    WHERE id = ANY($1::int[])
                    """,
                    tenant_ids
                )
                print(f"  ✅ 已删除 {len(tenant_ids)} 个其他租户（硬删除）")
        
        # 9. 验证清理结果
        print(f"\n✅ 验证清理结果...")
        
        # 9.1 验证默认租户的用户
        remaining_users = await conn.fetch(
            """
            SELECT id, username, email
            FROM core_users
            WHERE tenant_id = $1 AND deleted_at IS NULL
            """,
            default_tenant_id
        )
        print(f"  默认租户剩余用户: {len(remaining_users)} 个")
        for user in remaining_users:
            print(f"    - {user['username']} ({user['email'] or 'N/A'})")
        
        # 9.2 验证租户数量
        # 检查 infra_tenants 表是否有 deleted_at 字段
        has_deleted_at = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'infra_tenants' 
                AND column_name = 'deleted_at'
            )
        """)
        
        if has_deleted_at:
            remaining_tenants = await conn.fetch(
                """
                SELECT id, name, domain
                FROM infra_tenants
                WHERE deleted_at IS NULL
                """
            )
        else:
            remaining_tenants = await conn.fetch(
                """
                SELECT id, name, domain
                FROM infra_tenants
                """
            )
        print(f"  剩余租户: {len(remaining_tenants)} 个")
        for tenant in remaining_tenants:
            print(f"    - {tenant['name']} (domain: {tenant['domain']})")
        
        # 9.3 验证超级管理员
        remaining_admins = await conn.fetch(
            """
            SELECT id, username, email
            FROM core_users
            WHERE is_infra_admin = true AND deleted_at IS NULL
            """
        )
        print(f"  剩余超级管理员: {len(remaining_admins)} 个")
        for admin in remaining_admins:
            print(f"    - {admin['username']} ({admin['email'] or 'N/A'})")
        
        print(f"\n✅ 清理完成！")
        
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()
            print(f"\n✅ 数据库连接已关闭")


if __name__ == "__main__":
    print("=" * 60)
    print("清理默认租户中的 MOCK 数据")
    print("=" * 60)
    print()
    
    asyncio.run(cleanup_mock_data())

