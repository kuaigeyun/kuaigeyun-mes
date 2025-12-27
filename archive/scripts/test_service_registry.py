#!/usr/bin/env python
"""
服务注册表测试脚本

快速测试第二阶段改进的功能。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


async def test_service_registry():
    """测试服务注册表功能"""
    print("=" * 60)
    print("第二阶段改进 - 服务注册表测试")
    print("=" * 60)
    
    try:
        from core.services.interfaces.service_registry import ServiceLocator, service_registry
        from core.services.interfaces.service_interface import (
            UserServiceInterface,
            RoleServiceInterface,
            MessageServiceInterface,
        )
        
        print("\n1. 检查服务是否已注册")
        print("-" * 60)
        services_to_check = [
            "user_service",
            "role_service",
            "message_service",
            "application_service",
            "user_activity_service",
            "audit_log_service",
        ]
        
        for service_name in services_to_check:
            exists = ServiceLocator.has_service(service_name)
            status = "✅" if exists else "❌"
            print(f"{status} {service_name}: {'已注册' if exists else '未注册'}")
        
        print("\n2. 获取服务实例并检查类型")
        print("-" * 60)
        try:
            user_service = ServiceLocator.get_service("user_service")
            print(f"✅ user_service 获取成功")
            print(f"   - 类型: {type(user_service).__name__}")
            print(f"   - 服务名称: {user_service.service_name}")
            print(f"   - 服务版本: {user_service.service_version}")
            print(f"   - 是否实现接口: {isinstance(user_service, UserServiceInterface)}")
        except Exception as e:
            print(f"❌ user_service 获取失败: {e}")
        
        print("\n3. 测试服务健康检查")
        print("-" * 60)
        try:
            user_service = ServiceLocator.get_service("user_service")
            health = await user_service.health_check()
            print(f"✅ user_service 健康检查成功")
            print(f"   - 健康状态: {health}")
        except Exception as e:
            print(f"❌ user_service 健康检查失败: {e}")
        
        print("\n4. 列出所有已注册的服务")
        print("-" * 60)
        services = service_registry.list_services()
        print(f"✅ 已注册 {len(services)} 个服务:")
        for service_name in services:
            print(f"   - {service_name}")
        
        print("\n5. 测试服务注册表健康检查")
        print("-" * 60)
        try:
            health_info = await service_registry.health_check_all()
            print(f"✅ 服务注册表健康检查成功")
            print(f"   - 整体健康状态: {health_info.get('overall_healthy', False)}")
            print(f"   - 服务数量: {len(health_info.get('services', {}))}")
        except Exception as e:
            print(f"❌ 服务注册表健康检查失败: {e}")
        
        print("\n6. 测试向后兼容性（直接导入）")
        print("-" * 60)
        try:
            from core.services.user.user_service import UserService
            print(f"✅ 直接导入 UserService 成功")
            print(f"   - 类型: {type(UserService).__name__}")
        except Exception as e:
            print(f"❌ 直接导入 UserService 失败: {e}")
        
        print("\n7. 测试平台级服务注册表")
        print("-" * 60)
        try:
            from infra.services.service_registry import InfraServiceLocator, infra_service_registry
            
            # 注册一个测试服务
            class TestService:
                def test_method(self):
                    return "test"
            
            # 创建服务实例并保持引用
            test_service_instance = TestService()
            InfraServiceLocator.register_service("test_service", test_service_instance)
            
            # 立即获取服务
            retrieved_service = InfraServiceLocator.get_service("test_service")
            result = retrieved_service.test_method()
            
            if result == "test":
                print(f"✅ 平台级服务注册表测试成功")
                print(f"   - 测试服务注册成功")
                print(f"   - 测试服务调用成功: {result}")
            else:
                print(f"❌ 平台级服务注册表测试失败: 返回值不正确")
            
            # 清理测试服务
            infra_service_registry.unregister_service("test_service")
            
        except Exception as e:
            print(f"❌ 平台级服务注册表测试失败: {e}")
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
    # 注意：这个脚本需要在应用启动后运行，因为服务是在应用启动时注册的
    # 如果直接运行此脚本，需要先初始化服务
    print("⚠️  注意：此脚本需要在应用启动后运行")
    print("   或者确保服务已经初始化")
    print()
    
    # 尝试初始化服务（如果可能）
    try:
        # 设置日志级别为 INFO，以便看到注册信息
        import logging
        logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
        
        # 先初始化数据库连接（服务初始化可能需要）
        from infra.infrastructure.database.database import register_db
        from fastapi import FastAPI
        
        # 创建一个临时应用用于初始化数据库
        temp_app = FastAPI()
        asyncio.run(register_db(temp_app))
        print("✅ 数据库连接已初始化")
        
        # 初始化服务
        from core.services.interfaces.service_initializer import ServiceInitializer
        print("\n开始初始化服务...")
        try:
            asyncio.run(ServiceInitializer.initialize_services())
            print("✅ 服务初始化完成（无异常）")
        except Exception as e:
            print(f"❌ 服务初始化异常: {e}")
            import traceback
            traceback.print_exc()
        
        # 验证服务是否真的注册了
        from core.services.interfaces.service_registry import ServiceLocator, service_registry
        print(f"\n验证服务注册状态:")
        print(f"  - 已注册服务数量: {len(service_registry.list_services())}")
        print(f"  - 已注册服务类型数量: {len(service_registry.list_service_types())}")
        print(f"  - user_service 是否注册: {ServiceLocator.has_service('user_service')}")
        
        # 尝试手动注册一个服务来测试
        print(f"\n尝试手动注册服务进行测试...")
        try:
            from core.services.interfaces.service_interface import UserServiceInterface
            from core.services.interfaces.implementations.user_service_impl import UserServiceImpl
            
            # 先注册服务类型
            ServiceLocator.register_service_type(UserServiceInterface)
            print("  ✅ 服务类型注册成功")
            
            # 再注册服务实例
            user_service = UserServiceImpl()
            ServiceLocator.register_service("user_service", user_service)
            print("  ✅ 服务实例注册成功")
            print(f"  - 验证: user_service 是否注册: {ServiceLocator.has_service('user_service')}")
        except Exception as e:
            print(f"  ❌ 手动注册失败: {e}")
            import traceback
            traceback.print_exc()
        
    except Exception as e:
        print(f"⚠️  服务初始化失败: {e}")
        print("   提示：如果服务未初始化，测试将失败")
        print("   建议：在应用启动后运行此脚本，或确保服务已初始化")
        print()
        import traceback
        traceback.print_exc()
    
    # 运行测试
    asyncio.run(test_service_registry())

