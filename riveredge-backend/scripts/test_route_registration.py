"""
测试路由注册脚本

用于诊断应用路由注册问题
"""

import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

async def test_route_registration():
    """测试路由注册"""
    from core.services.application.application_registry_service import ApplicationRegistryService
    from core.services.application.application_service import ApplicationService
    
    print("=" * 60)
    print("测试应用路由注册")
    print("=" * 60)
    
    # 1. 测试文件系统扫描
    print("\n1. 测试文件系统扫描...")
    try:
        discovered_plugins = ApplicationService._scan_plugin_manifests()
        print(f"✅ 发现 {len(discovered_plugins)} 个应用:")
        for plugin in discovered_plugins:
            print(f"   - {plugin.get('name')} ({plugin.get('code')})")
    except Exception as e:
        print(f"❌ 文件系统扫描失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 2. 测试应用发现
    print("\n2. 测试应用发现...")
    try:
        await ApplicationRegistryService.reload_apps()
        registered_routes = ApplicationRegistryService.get_registered_routes()
        print(f"✅ 已注册 {len(registered_routes)} 个应用的路由:")
        for app_code, routers in registered_routes.items():
            print(f"   - {app_code}: {len(routers)} 个路由器")
    except Exception as e:
        print(f"❌ 应用发现失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 3. 测试路由模块导入
    print("\n3. 测试路由模块导入...")
    test_apps = ['kuaizhizao', 'master-data']
    for app_code in test_apps:
        module_code = app_code.replace('-', '_')
        route_module_path = f"apps.{module_code}.api.router"
        print(f"\n   测试 {app_code} -> {route_module_path}:")
        try:
            import importlib
            route_module = importlib.import_module(route_module_path)
            router = getattr(route_module, 'router', None)
            if router:
                print(f"   ✅ 路由模块导入成功，路由数量: {len(router.routes)}")
                # 打印前5个路由路径
                routes = [route.path for route in router.routes if hasattr(route, 'path')]
                print(f"   📋 路由路径示例: {routes[:5]}")
            else:
                print(f"   ⚠️ 路由模块中没有找到 router 对象")
        except ImportError as e:
            print(f"   ❌ 导入失败: {e}")
        except Exception as e:
            print(f"   ❌ 错误: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_route_registration())







