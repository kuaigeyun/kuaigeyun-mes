"""
测试重命名后的模型功能

验证数据库表重命名后，模型查询是否正常工作
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Windows 环境下修复异步网络兼容性问题
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from tortoise import Tortoise
from core.database import TORTOISE_ORM
from models.user import User
from models.role import Role
from models.permission import Permission
from models.tenant import Tenant
from models.tenant_config import TenantConfig


async def test_user_model():
    """测试用户模型"""
    print("=" * 60)
    print("测试用户模型 (root_users)")
    print("=" * 60)
    
    try:
        # 查询所有用户
        users = await User.all().limit(5)
        print(f"✅ 查询成功，找到 {len(users)} 个用户（限制5个）")
        
        # 查询平台管理员
        platform_admins = await User.filter(
            is_platform_admin=True,
            tenant_id__isnull=True
        ).limit(5)
        print(f"✅ 平台管理员查询成功，找到 {len(platform_admins)} 个")
        
        # 查询组织用户
        tenant_users = await User.filter(tenant_id=1).limit(5)
        print(f"✅ 组织用户查询成功（tenant_id=1），找到 {len(tenant_users)} 个")
        
        return True
    except Exception as e:
        print(f"❌ 用户模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_role_model():
    """测试角色模型"""
    print("\n" + "=" * 60)
    print("测试角色模型 (root_roles)")
    print("=" * 60)
    
    try:
        # 查询所有角色
        roles = await Role.all().limit(5)
        print(f"✅ 查询成功，找到 {len(roles)} 个角色（限制5个）")
        
        # 查询组织角色
        tenant_roles = await Role.filter(tenant_id=1).limit(5)
        print(f"✅ 组织角色查询成功（tenant_id=1），找到 {len(tenant_roles)} 个")
        
        return True
    except Exception as e:
        print(f"❌ 角色模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_permission_model():
    """测试权限模型"""
    print("\n" + "=" * 60)
    print("测试权限模型 (root_permissions)")
    print("=" * 60)
    
    try:
        # 查询所有权限
        permissions = await Permission.all().limit(5)
        print(f"✅ 查询成功，找到 {len(permissions)} 个权限（限制5个）")
        
        # 查询组织权限
        tenant_permissions = await Permission.filter(tenant_id=1).limit(5)
        print(f"✅ 组织权限查询成功（tenant_id=1），找到 {len(tenant_permissions)} 个")
        
        return True
    except Exception as e:
        print(f"❌ 权限模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_tenant_model():
    """测试组织模型"""
    print("\n" + "=" * 60)
    print("测试组织模型 (tree_tenants)")
    print("=" * 60)
    
    try:
        # 查询所有组织
        tenants = await Tenant.all()
        print(f"✅ 查询成功，找到 {len(tenants)} 个组织")
        
        # 查询激活的组织
        active_tenants = await Tenant.filter(status="active")
        print(f"✅ 激活组织查询成功，找到 {len(active_tenants)} 个")
        
        # 测试组织方法
        if tenants:
            tenant = tenants[0]
            is_active = await tenant.is_active()
            print(f"✅ 组织方法测试成功: {tenant.name} is_active={is_active}")
        
        return True
    except Exception as e:
        print(f"❌ 组织模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_tenant_config_model():
    """测试组织配置模型"""
    print("\n" + "=" * 60)
    print("测试组织配置模型 (tree_tenant_configs)")
    print("=" * 60)
    
    try:
        # 查询所有配置
        configs = await TenantConfig.all().limit(5)
        print(f"✅ 查询成功，找到 {len(configs)} 个配置（限制5个）")
        
        # 查询组织配置
        tenant_configs = await TenantConfig.filter(tenant_id=1).limit(5)
        print(f"✅ 组织配置查询成功（tenant_id=1），找到 {len(tenant_configs)} 个")
        
        return True
    except Exception as e:
        print(f"❌ 组织配置模型测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_tenant_isolation():
    """测试多租户隔离"""
    print("\n" + "=" * 60)
    print("测试多租户隔离")
    print("=" * 60)
    
    try:
        # 获取所有组织
        tenants = await Tenant.all().limit(3)
        print(f"✅ 找到 {len(tenants)} 个组织用于测试")
        
        for tenant in tenants:
            tenant_id = tenant.id
            # 查询该组织的用户
            users = await User.filter(tenant_id=tenant_id).limit(3)
            print(f"✅ 组织 {tenant_id} ({tenant.name}): {len(users)} 个用户")
            
            # 验证所有用户都属于该组织
            for user in users:
                if user.tenant_id != tenant_id:
                    print(f"❌ 错误：用户 {user.id} 不属于组织 {tenant_id}")
                    return False
        
        print("✅ 多租户隔离测试通过")
        return True
    except Exception as e:
        print(f"❌ 多租户隔离测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_relationships():
    """测试模型关系"""
    print("\n" + "=" * 60)
    print("测试模型关系")
    print("=" * 60)
    
    try:
        # 测试用户-角色关系
        users = await User.all().prefetch_related('roles').limit(3)
        print(f"✅ 用户-角色关系查询成功，找到 {len(users)} 个用户")
        
        for user in users:
            roles = await user.roles.all()
            print(f"   用户 {user.username}: {len(roles)} 个角色")
        
        # 测试角色-权限关系
        roles = await Role.all().prefetch_related('permissions').limit(3)
        print(f"✅ 角色-权限关系查询成功，找到 {len(roles)} 个角色")
        
        for role in roles:
            permissions = await role.permissions.all()
            print(f"   角色 {role.name}: {len(permissions)} 个权限")
        
        return True
    except Exception as e:
        print(f"❌ 模型关系测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """主测试函数"""
    print("=" * 60)
    print("测试重命名后的模型功能")
    print("=" * 60)
    print()
    
    # 初始化数据库连接
    try:
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ 数据库连接成功")
        print()
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    results = {}
    
    try:
        # 运行所有测试
        results["user_model"] = await test_user_model()
        results["role_model"] = await test_role_model()
        results["permission_model"] = await test_permission_model()
        results["tenant_model"] = await test_tenant_model()
        results["tenant_config_model"] = await test_tenant_config_model()
        results["tenant_isolation"] = await test_tenant_isolation()
        results["relationships"] = await test_relationships()
        
        # 输出测试结果
        print("\n" + "=" * 60)
        print("测试结果总结")
        print("=" * 60)
        for test_name, result in results.items():
            status = "✅ 通过" if result else "❌ 失败"
            print(f"{test_name:25s}: {status}")
        
        total = len(results)
        passed = sum(1 for r in results.values() if r)
        print(f"\n总计: {passed}/{total} 通过")
        
        if passed == total:
            print("\n🎉 所有模型测试通过！数据库重命名成功！")
        else:
            print(f"\n⚠️  有 {total - passed} 个测试失败")
    
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        print("\n✅ 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(main())

