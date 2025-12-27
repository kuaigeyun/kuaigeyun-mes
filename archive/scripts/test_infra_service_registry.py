"""
平台级服务注册表测试脚本

测试平台级服务的注册、发现和依赖注入功能。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
import os
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Ensure environment variables are set for DB connection
os.environ["DATABASE_URL"] = os.getenv("DATABASE_URL", "postgres://riveredge:riveredge@localhost:5432/riveredge_db")
os.environ["REDIS_URL"] = os.getenv("REDIS_URL", "redis://localhost:6379/0")

async def test_infra_service_registry():
    """测试平台级服务注册表功能"""
    print("=" * 60)
    print("平台级优先级2架构改进 - 服务注册表测试")
    print("=" * 60)
    
    try:
        from infra.services.service_registry import InfraServiceLocator, infra_service_registry
        from infra.services.interfaces.service_interface import (
            AuthServiceInterface,
            TenantServiceInterface,
            PackageServiceInterface,
            InfraSuperAdminServiceInterface,
            SavedSearchServiceInterface,
        )
        from infra.services.interfaces.service_initializer import InfraServiceInitializer

        # 模拟 FastAPI 应用启动时的初始化
        from infra.infrastructure.database.database import register_db
        from fastapi import FastAPI

        print("\n✅ 数据库连接已初始化")
        await register_db(FastAPI())  # Pass a dummy FastAPI app for initialization
        
        print("\n开始初始化平台级服务...")
        await InfraServiceInitializer.initialize_services()
        print("✅ 平台级服务已初始化")

        # 检查 InfraServiceRegistry 的内部状态
        print("\n内部 InfraServiceRegistry 状态:")
        print(f"  - 已注册服务数量: {len(infra_service_registry._services)}")
        print(f"  - auth_service 是否注册: {'auth_service' in infra_service_registry._services}")
        print(f"  - tenant_service 是否注册: {'tenant_service' in infra_service_registry._services}")

        print("\n1. 检查服务是否已注册")
        print("-" * 60)
        services_to_check = [
            "auth_service",
            "tenant_service",
            "package_service",
            "infra_superadmin_service",
            "saved_search_service",
        ]
        
        for service_name in services_to_check:
            exists = InfraServiceLocator.has_service(service_name)
            status = "✅" if exists else "❌"
            print(f"{status} {service_name}: {'已注册' if exists else '未注册'}")
        
        print("\n2. 获取服务实例并检查类型")
        print("-" * 60)
        try:
            auth_service = InfraServiceLocator.get_service("auth_service")
            print("✅ auth_service 获取成功")
            print(f"   - 类型: {type(auth_service).__name__}")
            print(f"   - 服务名称: {auth_service.service_name}")
            print(f"   - 服务版本: {auth_service.service_version}")
            print(f"   - 是否实现接口: {isinstance(auth_service, AuthServiceInterface)}")
        except Exception as e:
            print(f"❌ auth_service 获取失败: {e}")
            import traceback
            traceback.print_exc()

        print("\n3. 测试服务健康检查")
        print("-" * 60)
        try:
            auth_service = InfraServiceLocator.get_service("auth_service")
            health_status = await auth_service.health_check()
            print("✅ auth_service 健康检查成功")
            print(f"   - 健康状态: {health_status}")
        except Exception as e:
            print(f"❌ auth_service 健康检查失败: {e}")
            import traceback
            traceback.print_exc()

        print("\n4. 列出所有已注册的服务")
        print("-" * 60)
        registered_services = InfraServiceLocator.list_services()
        print(f"✅ 已注册 {len(registered_services)} 个服务:")
        for s in registered_services:
            print(f"   - {s}")

        print("\n5. 测试服务接口方法")
        print("-" * 60)
        try:
            auth_service = InfraServiceLocator.get_service("auth_service")
            # 检查接口方法是否存在
            methods = ['login', 'register', 'guest_login', 'register_personal', 'register_organization']
            for method in methods:
                has_method = hasattr(auth_service, method)
                status = "✅" if has_method else "❌"
                print(f"{status} auth_service.{method}: {'存在' if has_method else '不存在'}")
        except Exception as e:
            print(f"❌ 测试服务接口方法失败: {e}")
            import traceback
            traceback.print_exc()

        print("\n6. 测试依赖注入函数")
        print("-" * 60)
        try:
            from infra.api.deps.services import (
                get_auth_service,
                get_tenant_service,
                get_package_service,
                get_auth_service_with_fallback,
                get_tenant_service_with_fallback,
            )
            
            # 测试直接获取服务
            auth_service = get_auth_service()
            if auth_service:
                print("✅ get_auth_service() 成功")
                print(f"   - 类型: {type(auth_service).__name__}")
            else:
                print("⚠️ get_auth_service() 返回 None（服务未注册）")
            
            # 测试带回退的获取服务
            auth_service_fallback = get_auth_service_with_fallback()
            print("✅ get_auth_service_with_fallback() 成功")
            print(f"   - 类型: {type(auth_service_fallback).__name__}")
            
        except Exception as e:
            print(f"❌ 测试依赖注入函数失败: {e}")
            import traceback
            traceback.print_exc()

        print("\n7. 测试向后兼容性（直接导入）")
        print("-" * 60)
        try:
            from infra.services.auth_service import AuthService
            from infra.services.tenant_service import TenantService
            print("✅ 直接导入 AuthService 成功")
            print(f"   - 类型: {type(AuthService).__name__}")
            print("✅ 直接导入 TenantService 成功")
            print(f"   - 类型: {type(TenantService).__name__}")
        except Exception as e:
            print(f"❌ 直接导入服务失败: {e}")
            import traceback
            traceback.print_exc()

        print("\n8. 测试服务实现类")
        print("-" * 60)
        try:
            from infra.services.interfaces.implementations.auth_service_impl import AuthServiceImpl
            from infra.services.interfaces.implementations.tenant_service_impl import TenantServiceImpl
            
            # 创建服务实例
            auth_impl = AuthServiceImpl()
            tenant_impl = TenantServiceImpl()
            
            print("✅ AuthServiceImpl 创建成功")
            print(f"   - 服务名称: {auth_impl.service_name}")
            print(f"   - 服务版本: {auth_impl.service_version}")
            print(f"   - 是否实现接口: {isinstance(auth_impl, AuthServiceInterface)}")
            
            print("✅ TenantServiceImpl 创建成功")
            print(f"   - 服务名称: {tenant_impl.service_name}")
            print(f"   - 服务版本: {tenant_impl.service_version}")
            print(f"   - 是否实现接口: {isinstance(tenant_impl, TenantServiceInterface)}")
            
        except Exception as e:
            print(f"❌ 测试服务实现类失败: {e}")
            import traceback
            traceback.print_exc()
        
        print("\n" + "=" * 60)
        print("✅ 测试完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # 设置日志级别为 INFO，以便看到注册信息
    import logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
    
    asyncio.run(test_infra_service_registry())

