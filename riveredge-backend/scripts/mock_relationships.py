"""
为MOCK数据建立关联关系

只关联已存在的MOCK数据，不影响程序逻辑：
1. 为角色分配权限（RolePermission）
2. 为用户分配角色（UserRole）
3. 用户已经关联了部门和职位（在mock_users.py中已处理）

使用方法：
    python scripts/mock_relationships.py [tenant_id]
    
示例：
    python scripts/mock_relationships.py 1  # 为组织1的MOCK数据建立关联
"""

import asyncio
import random
import sys
import os
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
os.environ['USE_TZ'] = 'True'
os.environ['TIMEZONE'] = 'Asia/Shanghai'

from soil.config.platform_config import setup_tortoise_timezone_env, platform_settings
setup_tortoise_timezone_env()

import uuid
from tortoise import Tortoise
from soil.models.user import User
from tree_root.models.role import Role
from tree_root.models.permission import Permission
from tree_root.models.user_role import UserRole
from tree_root.models.role_permission import RolePermission
from tree_root.models.department import Department
from tree_root.models.position import Position
from soil.infrastructure.database.database import TORTOISE_ORM


async def mock_relationships(tenant_id: int = 1):
    """
    为MOCK数据建立关联关系
    
    Args:
        tenant_id: 组织ID
    """
    # 确保时区配置正确
    TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
    TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
    
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 验证租户是否存在
        from soil.models.tenant import Tenant
        tenant = await Tenant.filter(id=tenant_id).first()
        if not tenant:
            print(f"❌ 错误：租户 ID {tenant_id} 不存在")
            return
        print(f"📋 使用租户: {tenant.name} (ID: {tenant_id})")
        
        # 1. 获取所有角色和权限
        roles = await Role.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        permissions = await Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        if not roles:
            print("❌ 没有找到角色，请先创建角色")
            return
        
        if not permissions:
            print("❌ 没有找到权限，请先创建权限")
            return
        
        print(f"📋 找到 {len(roles)} 个角色，{len(permissions)} 个权限")
        
        # 2. 为角色分配权限（每个角色随机分配3-8个权限）
        print(f"\n🔗 开始为角色分配权限...")
        role_permission_count = 0
        
        for role in roles:
            # 跳过系统角色（系统角色可能已有固定权限）
            if role.is_system:
                print(f"   ⚠️  跳过系统角色: {role.name} ({role.code})")
                continue
            
            # 随机选择3-8个权限
            num_permissions = random.randint(3, min(8, len(permissions)))
            selected_permissions = random.sample(permissions, num_permissions)
            
            # 检查是否已有权限关联（直接查询关联表）
            existing_count = await RolePermission.filter(
                role_id=role.id
            ).count()
            if existing_count > 0:
                print(f"   ⚠️  角色 {role.name} 已有 {existing_count} 个权限，跳过")
                continue
            
            # 分配权限（直接创建关联记录）
            for permission in selected_permissions:
                # 检查是否已存在
                existing = await RolePermission.filter(
                    role_id=role.id,
                    permission_id=permission.id
                ).first()
                if not existing:
                    # 直接使用SQL插入，避免模型字段限制
                    from tortoise import connections
                    conn = connections.get("default")
                    await conn.execute_query(
                        "INSERT INTO sys_role_permissions (uuid, role_id, permission_id, created_at) VALUES ($1, $2, $3, NOW())",
                        [str(uuid.uuid4()), role.id, permission.id]
                    )
            permission_names = [p.name for p in selected_permissions]
            print(f"   ✅ 为角色 {role.name} 分配了 {len(selected_permissions)} 个权限: {', '.join(permission_names[:3])}{'...' if len(permission_names) > 3 else ''}")
            role_permission_count += len(selected_permissions)
        
        print(f"   ✨ 共为角色分配了 {role_permission_count} 个权限关联")
        
        # 3. 获取所有用户
        users = await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        if not users:
            print("❌ 没有找到用户，请先创建用户")
            return
        
        print(f"\n📋 找到 {len(users)} 个用户")
        
        # 4. 为用户分配角色（每个用户随机分配1-2个角色）
        print(f"\n🔗 开始为用户分配角色...")
        user_role_count = 0
        
        for user in users:
            # 检查是否已有角色（直接查询关联表）
            existing_count = await UserRole.filter(
                user_id=user.id
            ).count()
            if existing_count > 0:
                print(f"   ⚠️  用户 {user.full_name or user.username} 已有 {existing_count} 个角色，跳过")
                continue
            
            # 随机选择1-2个角色
            num_roles = random.randint(1, min(2, len(roles)))
            selected_roles = random.sample(roles, num_roles)
            
            # 分配角色（直接创建关联记录）
            for role in selected_roles:
                # 检查是否已存在
                existing = await UserRole.filter(
                    user_id=user.id,
                    role_id=role.id
                ).first()
                if not existing:
                    # 直接使用SQL插入，避免模型字段限制
                    from tortoise import connections
                    conn = connections.get("default")
                    await conn.execute_query(
                        "INSERT INTO sys_user_roles (uuid, user_id, role_id, created_at) VALUES ($1, $2, $3, NOW())",
                        [str(uuid.uuid4()), user.id, role.id]
                    )
            role_names = [r.name for r in selected_roles]
            print(f"   ✅ 为用户 {user.full_name or user.username} 分配了 {len(selected_roles)} 个角色: {', '.join(role_names)}")
            user_role_count += len(selected_roles)
        
        print(f"   ✨ 共为用户分配了 {user_role_count} 个角色关联")
        
        # 5. 统计信息
        print(f"\n✨ 完成！")
        print(f"   - 角色-权限关联: {role_permission_count} 个")
        print(f"   - 用户-角色关联: {user_role_count} 个")
        print(f"\n📊 关联统计:")
        
        # 统计每个角色的权限数量
        print(f"   角色权限统计:")
        for role in roles:
            if not role.is_system:
                role_perms_count = await RolePermission.filter(
                    role_id=role.id
                ).count()
                print(f"     - {role.name}: {role_perms_count} 个权限")
        
        # 统计每个用户的角色数量
        print(f"   用户角色统计（前10个）:")
        for i, user in enumerate(users[:10]):
            user_roles_count = await UserRole.filter(
                user_id=user.id
            ).count()
            print(f"     - {user.full_name or user.username}: {user_roles_count} 个角色")
        
        if len(users) > 10:
            print(f"     ... 还有 {len(users) - 10} 个用户")
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    # 从命令行参数获取配置
    tenant_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    
    print(f"🚀 开始为组织 {tenant_id} 的MOCK数据建立关联关系...")
    print(f"   注意：此脚本只关联已存在的MOCK数据，不影响程序逻辑")
    asyncio.run(mock_relationships(tenant_id=tenant_id))

