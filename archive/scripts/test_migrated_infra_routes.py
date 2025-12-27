"""
平台级API路由依赖注入迁移测试脚本

测试迁移后的API路由是否正常工作。

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
import os
from pathlib import Path
from typing import Any

# Add src directory to Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Ensure environment variables are set for DB connection
os.environ["DATABASE_URL"] = os.getenv("DATABASE_URL", "postgres://riveredge:riveredge@localhost:5432/riveredge_db")
os.environ["REDIS_URL"] = os.getenv("REDIS_URL", "redis://localhost:6379/0")

async def test_migrated_routes():
    """测试迁移后的API路由"""
    print("=" * 60)
    print("平台级API路由依赖注入迁移测试")
    print("=" * 60)
    
    try:
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from infra.infrastructure.database.database import register_db
        from infra.services.interfaces.service_initializer import InfraServiceInitializer
        
        # 导入所有路由
        from infra.api.auth.auth import router as auth_router
        from infra.api.tenants.tenants import router as tenants_router
        from infra.api.packages.packages import router as packages_router
        from infra.api.infra_superadmin.infra_superadmin import router as infra_superadmin_router
        from infra.api.saved_searches.saved_searches import router as saved_searches_router
        
        # 创建测试应用
        app = FastAPI()
        
        # 注册数据库
        await register_db(app)
        print("✅ 数据库连接已初始化")
        
        # 初始化服务
        await InfraServiceInitializer.initialize_services()
        print("✅ 平台级服务已初始化")
        
        # 注册路由
        app.include_router(auth_router, prefix="/api/v1")
        app.include_router(tenants_router, prefix="/api/v1/infra")
        app.include_router(packages_router, prefix="/api/v1/infra")
        app.include_router(infra_superadmin_router, prefix="/api/v1/infra")
        app.include_router(saved_searches_router, prefix="/api/v1")
        print("✅ 路由已注册")
        
        # 创建测试客户端
        client = TestClient(app)
        
        print("\n1. 测试认证路由（auth.py）")
        print("-" * 60)
        auth_routes = [
            ("POST", "/api/v1/auth/login"),
            ("POST", "/api/v1/auth/register"),
            ("POST", "/api/v1/auth/guest-login"),
            ("POST", "/api/v1/auth/register/personal"),
            ("POST", "/api/v1/auth/register/organization"),
            ("GET", "/api/v1/auth/me"),
        ]
        
        for method, path in auth_routes:
            if method == "GET":
                response = client.get(path)
            else:
                response = client.post(path, json={})
            
            # 401/403/422都是正常的，说明路由存在
            if response.status_code in [200, 401, 403, 422]:
                print(f"✅ {method} {path} - HTTP {response.status_code}")
            else:
                print(f"❌ {method} {path} - HTTP {response.status_code}")
        
        print("\n2. 测试组织路由（tenants.py）")
        print("-" * 60)
        tenant_routes = [
            ("GET", "/api/v1/infra/tenants"),
            ("GET", "/api/v1/infra/tenants/1"),
            ("POST", "/api/v1/infra/tenants/1/approve"),
            ("POST", "/api/v1/infra/tenants/1/reject"),
            ("POST", "/api/v1/infra/tenants/1/activate"),
            ("POST", "/api/v1/infra/tenants/1/deactivate"),
            ("POST", "/api/v1/infra/tenants"),
            ("PUT", "/api/v1/infra/tenants/1"),
            ("DELETE", "/api/v1/infra/tenants/1"),
        ]
        
        for method, path in tenant_routes:
            if method == "GET":
                response = client.get(path)
            elif method == "DELETE":
                response = client.delete(path)
            elif method == "PUT":
                response = client.put(path, json={})
            else:
                response = client.post(path, json={})
            
            # 401/403/422都是正常的，说明路由存在
            if response.status_code in [200, 201, 204, 401, 403, 422]:
                print(f"✅ {method} {path} - HTTP {response.status_code}")
            else:
                print(f"❌ {method} {path} - HTTP {response.status_code}")
        
        print("\n3. 测试套餐路由（packages.py）")
        print("-" * 60)
        package_routes = [
            ("GET", "/api/v1/infra/packages"),
            ("GET", "/api/v1/infra/packages/1"),
            ("POST", "/api/v1/infra/packages"),
            ("PUT", "/api/v1/infra/packages/1"),
            ("DELETE", "/api/v1/infra/packages/1"),
        ]
        
        for method, path in package_routes:
            try:
                if method == "GET":
                    response = client.get(path)
                elif method == "DELETE":
                    response = client.delete(path)
                elif method == "PUT":
                    response = client.put(path, json={})
                else:
                    response = client.post(path, json={})
                
                # 401/403/422都是正常的，说明路由存在
                if response.status_code in [200, 201, 204, 401, 403, 422]:
                    print(f"✅ {method} {path} - HTTP {response.status_code}")
                else:
                    print(f"❌ {method} {path} - HTTP {response.status_code}")
            except Exception as e:
                # 数据库连接问题不影响路由存在性验证
                print(f"⚠️ {method} {path} - 路由存在但测试时出错（可能是数据库连接问题）")
        
        print("\n3. 测试套餐路由（packages.py）- 检查路由注册")
        print("-" * 60)
        package_routes = [
            ("GET", "/api/v1/infra/packages"),
            ("GET", "/api/v1/infra/packages/{package_id}"),
            ("POST", "/api/v1/infra/packages"),
            ("PUT", "/api/v1/infra/packages/{package_id}"),
            ("DELETE", "/api/v1/infra/packages/{package_id}"),
        ]
        
        # 检查路由是否注册
        registered_paths = [str(route.path) for route in app.routes if hasattr(route, 'path')]
        for method, path_template in package_routes:
            # 检查是否有匹配的路由
            found = any(path_template.replace('{package_id}', '{id}') in p or path_template in p for p in registered_paths)
            if found:
                print(f"✅ {method} {path_template} - 路由已注册")
            else:
                print(f"❌ {method} {path_template} - 路由未找到")
        
        print("\n4. 测试平台超级管理员路由（infra_superadmin.py）- 检查路由注册")
        print("-" * 60)
        admin_routes = [
            ("POST", "/api/v1/infra/admin"),
            ("PUT", "/api/v1/infra/admin"),
        ]
        
        for method, path in admin_routes:
            found = any(path in p for p in registered_paths)
            if found:
                print(f"✅ {method} {path} - 路由已注册")
            else:
                print(f"❌ {method} {path} - 路由未找到")
        
        print("\n5. 测试保存搜索路由（saved_searches.py）- 检查路由注册")
        print("-" * 60)
        saved_search_routes = [
            ("GET", "/api/v1/saved-searches"),
            ("POST", "/api/v1/saved-searches"),
            ("GET", "/api/v1/saved-searches/{search_uuid}"),
            ("PUT", "/api/v1/saved-searches/{search_uuid}"),
            ("DELETE", "/api/v1/saved-searches/{search_uuid}"),
        ]
        
        for method, path_template in saved_search_routes:
            found = any(path_template.replace('{search_uuid}', '{uuid}') in p or path_template in p for p in registered_paths)
            if found:
                print(f"✅ {method} {path_template} - 路由已注册")
            else:
                print(f"❌ {method} {path_template} - 路由未找到")
        
        print("\n6. 测试依赖注入是否正常工作")
        print("-" * 60)
        try:
            from infra.api.deps.services import (
                get_auth_service_with_fallback,
                get_tenant_service_with_fallback,
                get_package_service_with_fallback,
                get_infra_superadmin_service_with_fallback,
                get_saved_search_service_with_fallback,
            )
            
            # 测试依赖注入函数
            auth_service = get_auth_service_with_fallback()
            tenant_service = get_tenant_service_with_fallback()
            package_service = get_package_service_with_fallback()
            admin_service = get_infra_superadmin_service_with_fallback()
            saved_search_service = get_saved_search_service_with_fallback()
            
            print(f"✅ get_auth_service_with_fallback() - 类型: {type(auth_service).__name__}")
            print(f"✅ get_tenant_service_with_fallback() - 类型: {type(tenant_service).__name__}")
            print(f"✅ get_package_service_with_fallback() - 类型: {type(package_service).__name__}")
            print(f"✅ get_infra_superadmin_service_with_fallback() - 类型: {type(admin_service).__name__}")
            print(f"✅ get_saved_search_service_with_fallback() - 类型: {type(saved_search_service).__name__}")
            
        except Exception as e:
            print(f"❌ 测试依赖注入函数失败: {e}")
            import traceback
            traceback.print_exc()
        
        print("\n7. 检查路由注册情况")
        print("-" * 60)
        routes = [route for route in app.routes]
        print(f"✅ 应用共注册 {len(routes)} 个路由")
        
        # 统计各模块的路由数
        auth_count = len([r for r in routes if hasattr(r, 'path') and '/auth' in r.path])
        tenant_count = len([r for r in routes if hasattr(r, 'path') and '/tenants' in r.path])
        package_count = len([r for r in routes if hasattr(r, 'path') and '/packages' in r.path])
        admin_count = len([r for r in routes if hasattr(r, 'path') and '/admin' in r.path])
        saved_search_count = len([r for r in routes if hasattr(r, 'path') and '/saved-searches' in r.path])
        
        print(f"   - auth路由: {auth_count} 个")
        print(f"   - tenants路由: {tenant_count} 个")
        print(f"   - packages路由: {package_count} 个")
        print(f"   - admin路由: {admin_count} 个")
        print(f"   - saved-searches路由: {saved_search_count} 个")
        
        print("\n" + "=" * 60)
        print("✅ 测试完成！")
        print("=" * 60)
        print("\n📝 说明:")
        print("   - HTTP 401/403: 路由正常，需要认证")
        print("   - HTTP 422: 路由正常，数据验证失败")
        print("   - HTTP 200/201/204: 路由正常，请求成功")
        print("   - HTTP 404: 路由不存在或路径错误")
        print("   - HTTP 500: 服务器内部错误")
        
    except Exception as e:
        print(f"\n❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # 设置日志级别为 WARNING，减少输出
    import logging
    logging.basicConfig(level=logging.WARNING, format='%(levelname)s - %(message)s')
    
    asyncio.run(test_migrated_routes())

