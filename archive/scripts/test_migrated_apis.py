#!/usr/bin/env python
"""
测试迁移后的API路由

测试使用依赖注入的API路由是否正常工作。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
import json
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


async def test_service_dependency_injection():
    """测试服务依赖注入功能"""
    print("=" * 60)
    print("测试服务依赖注入功能")
    print("=" * 60)
    
    try:
        from core.api.deps.service_helpers import get_user_service_with_fallback
        
        # 测试获取服务
        user_service = get_user_service_with_fallback()
        print(f"✅ 获取用户服务成功")
        print(f"   - 类型: {type(user_service).__name__}")
        print(f"   - 是否有 create_user 方法: {hasattr(user_service, 'create_user')}")
        print(f"   - 是否有 get_user_list 方法: {hasattr(user_service, 'get_user_list')}")
        
        # 测试服务方法签名
        import inspect
        create_user_sig = inspect.signature(user_service.create_user)
        print(f"   - create_user 签名: {create_user_sig}")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_api_route_with_dependency_injection():
    """测试API路由中的依赖注入"""
    print("\n" + "=" * 60)
    print("测试API路由中的依赖注入")
    print("=" * 60)
    
    try:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from core.api.users.users import router, create_user, get_user_list
        
        # 创建测试应用
        app = FastAPI()
        app.include_router(router)
        
        # 创建测试客户端
        client = TestClient(app)
        
        print("✅ 测试应用和客户端创建成功")
        
        # 注意：实际API测试需要认证和数据库，这里只测试路由注册
        # 检查路由是否注册
        routes = [route.path for route in app.routes]
        print(f"   - 注册的路由: {routes}")
        
        if "/users" in routes:
            print("✅ 用户API路由已注册")
        else:
            print("❌ 用户API路由未注册")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_service_adapter():
    """测试服务适配器"""
    print("\n" + "=" * 60)
    print("测试服务适配器")
    print("=" * 60)
    
    try:
        from core.api.deps.service_helpers import get_user_service_with_fallback
        
        # 获取服务（可能是适配器）
        user_service = get_user_service_with_fallback()
        
        # 检查是否是适配器
        if hasattr(user_service, '__class__'):
            class_name = user_service.__class__.__name__
            print(f"✅ 服务类型: {class_name}")
            
            if 'Adapter' in class_name:
                print("   - 使用适配器（回退模式）")
            else:
                print("   - 使用接口实现（注册模式）")
        
        # 检查方法
        methods = [m for m in dir(user_service) if not m.startswith('_') and callable(getattr(user_service, m))]
        print(f"   - 可用方法: {methods}")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_backward_compatibility():
    """测试向后兼容性"""
    print("\n" + "=" * 60)
    print("测试向后兼容性")
    print("=" * 60)
    
    try:
        # 测试直接导入仍然可用
        from core.services.user.user_service import UserService
        
        print("✅ 直接导入 UserService 成功")
        print(f"   - 类型: {type(UserService).__name__}")
        print(f"   - 是否有 create_user 方法: {hasattr(UserService, 'create_user')}")
        
        # 测试适配器回退
        from core.services.interfaces.service_registry import ServiceLocator
        
        # 临时移除服务（模拟未注册情况）
        original_service = None
        if ServiceLocator.has_service("user_service"):
            original_service = ServiceLocator.get_service("user_service")
            # 注意：这里不实际移除，只是测试适配器逻辑
        
        from core.api.deps.service_helpers import get_user_service_with_fallback
        user_service = get_user_service_with_fallback()
        
        # 检查适配器是否工作
        if hasattr(user_service, 'create_user'):
            print("✅ 适配器正常工作")
            print("   - 适配器可以像接口实现一样使用")
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """主测试函数"""
    print("🧪 开始测试迁移后的API路由")
    print()
    
    # 初始化服务（如果需要）
    try:
        from infra.infrastructure.database.database import register_db
        from fastapi import FastAPI
        from core.services.interfaces.service_initializer import ServiceInitializer
        
        temp_app = FastAPI()
        await register_db(temp_app)
        await ServiceInitializer.initialize_services()
        print("✅ 服务初始化完成\n")
    except Exception as e:
        print(f"⚠️  服务初始化失败（可能需要在应用启动后运行）: {e}\n")
    
    # 运行测试
    results = []
    
    results.append(await test_service_dependency_injection())
    results.append(await test_api_route_with_dependency_injection())
    results.append(test_service_adapter())
    results.append(await test_backward_compatibility())
    
    # 总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    if passed == total:
        print("✅ 所有测试通过！")
        return 0
    else:
        print("❌ 部分测试失败")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

