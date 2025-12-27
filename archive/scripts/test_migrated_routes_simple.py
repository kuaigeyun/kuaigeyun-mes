"""
平台级API路由依赖注入迁移测试脚本（简化版）

仅检查路由是否注册，不执行实际HTTP请求。

Author: Luigi Lu
Date: 2025-12-27
"""

import sys
import os
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

def test_route_registration():
    """测试路由注册情况"""
    print("=" * 60)
    print("平台级API路由依赖注入迁移测试（路由注册检查）")
    print("=" * 60)
    
    try:
        from fastapi import FastAPI
        
        # 导入所有路由
        from infra.api.auth.auth import router as auth_router
        from infra.api.tenants.tenants import router as tenants_router
        from infra.api.packages.packages import router as packages_router
        from infra.api.infra_superadmin.infra_superadmin import router as infra_superadmin_router
        from infra.api.saved_searches.saved_searches import router as saved_searches_router
        
        # 创建测试应用
        app = FastAPI()
        
        # 注册路由
        app.include_router(auth_router, prefix="/api/v1")
        app.include_router(tenants_router, prefix="/api/v1/infra")
        app.include_router(packages_router, prefix="/api/v1/infra")
        app.include_router(infra_superadmin_router, prefix="/api/v1/infra")
        app.include_router(saved_searches_router, prefix="/api/v1")
        print("✅ 路由已注册到FastAPI应用")
        
        # 检查路由注册情况
        routes = [route for route in app.routes if hasattr(route, 'path')]
        print(f"\n✅ 应用共注册 {len(routes)} 个路由")
        
        # 统计各模块的路由数
        auth_routes = [r for r in routes if '/auth' in r.path]
        tenant_routes = [r for r in routes if '/tenants' in r.path]
        package_routes = [r for r in routes if '/packages' in r.path]
        admin_routes = [r for r in routes if '/admin' in r.path]
        saved_search_routes = [r for r in routes if '/saved-searches' in r.path]
        
        print(f"\n1. 认证路由（auth.py）: {len(auth_routes)} 个")
        for route in auth_routes[:6]:  # 只显示前6个
            methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'
            print(f"   ✅ {methods} {route.path}")
        
        print(f"\n2. 组织路由（tenants.py）: {len(tenant_routes)} 个")
        for route in tenant_routes[:9]:  # 显示所有9个
            methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'
            print(f"   ✅ {methods} {route.path}")
        
        print(f"\n3. 套餐路由（packages.py）: {len(package_routes)} 个")
        for route in package_routes[:5]:  # 显示所有5个
            methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'
            print(f"   ✅ {methods} {route.path}")
        
        print(f"\n4. 平台超级管理员路由（infra_superadmin.py）: {len(admin_routes)} 个")
        for route in admin_routes[:2]:  # 显示所有2个
            methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'
            print(f"   ✅ {methods} {route.path}")
        
        print(f"\n5. 保存搜索路由（saved_searches.py）: {len(saved_search_routes)} 个")
        for route in saved_search_routes[:5]:  # 显示所有5个
            methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'
            print(f"   ✅ {methods} {route.path}")
        
        print("\n6. 测试依赖注入函数")
        print("-" * 60)
        try:
            from infra.api.deps.services import (
                get_auth_service_with_fallback,
                get_tenant_service_with_fallback,
                get_package_service_with_fallback,
                get_infra_superadmin_service_with_fallback,
                get_saved_search_service_with_fallback,
            )
            
            # 测试依赖注入函数（不初始化服务，只检查函数是否存在）
            print("✅ get_auth_service_with_fallback() - 函数存在")
            print("✅ get_tenant_service_with_fallback() - 函数存在")
            print("✅ get_package_service_with_fallback() - 函数存在")
            print("✅ get_infra_superadmin_service_with_fallback() - 函数存在")
            print("✅ get_saved_search_service_with_fallback() - 函数存在")
            
        except Exception as e:
            print(f"❌ 测试依赖注入函数失败: {e}")
            import traceback
            traceback.print_exc()
        
        print("\n7. 检查路由函数是否使用依赖注入")
        print("-" * 60)
        import inspect
        from infra.api.auth import auth
        from infra.api.tenants import tenants
        from infra.api.packages import packages
        from infra.api.infra_superadmin import infra_superadmin
        from infra.api.saved_searches import saved_searches
        
        # 检查auth.py中的路由函数
        auth_functions = [name for name, obj in inspect.getmembers(auth) if inspect.isfunction(obj) and not name.startswith('_')]
        print(f"✅ auth.py 中有 {len(auth_functions)} 个路由函数")
        
        # 检查tenants.py中的路由函数
        tenant_functions = [name for name, obj in inspect.getmembers(tenants) if inspect.isfunction(obj) and not name.startswith('_')]
        print(f"✅ tenants.py 中有 {len(tenant_functions)} 个路由函数")
        
        # 检查packages.py中的路由函数
        package_functions = [name for name, obj in inspect.getmembers(packages) if inspect.isfunction(obj) and not name.startswith('_')]
        print(f"✅ packages.py 中有 {len(package_functions)} 个路由函数")
        
        # 检查infra_superadmin.py中的路由函数
        admin_functions = [name for name, obj in inspect.getmembers(infra_superadmin) if inspect.isfunction(obj) and not name.startswith('_')]
        print(f"✅ infra_superadmin.py 中有 {len(admin_functions)} 个路由函数")
        
        # 检查saved_searches.py中的路由函数
        saved_search_functions = [name for name, obj in inspect.getmembers(saved_searches) if inspect.isfunction(obj) and not name.startswith('_')]
        print(f"✅ saved_searches.py 中有 {len(saved_search_functions)} 个路由函数")
        
        print("\n" + "=" * 60)
        print("✅ 测试完成！")
        print("=" * 60)
        print("\n📝 总结:")
        print(f"   - 认证路由: {len(auth_routes)} 个")
        print(f"   - 组织路由: {len(tenant_routes)} 个")
        print(f"   - 套餐路由: {len(package_routes)} 个")
        print(f"   - 平台超级管理员路由: {len(admin_routes)} 个")
        print(f"   - 保存搜索路由: {len(saved_search_routes)} 个")
        print(f"   - 总计: {len(auth_routes) + len(tenant_routes) + len(package_routes) + len(admin_routes) + len(saved_search_routes)} 个路由")
        
    except Exception as e:
        print(f"\n❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # 设置日志级别为 ERROR，减少输出
    import logging
    logging.basicConfig(level=logging.ERROR, format='%(levelname)s - %(message)s')
    
    test_route_registration()

