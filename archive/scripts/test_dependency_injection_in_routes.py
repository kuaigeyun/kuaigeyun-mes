"""
检查路由函数是否使用依赖注入

Author: Luigi Lu
Date: 2025-12-27
"""

import inspect
import sys
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

def check_dependency_injection():
    """检查路由函数是否使用依赖注入"""
    print("=" * 60)
    print("检查路由函数是否使用依赖注入")
    print("=" * 60)
    
    # 需要检查的依赖注入函数
    di_functions = [
        'get_auth_service_with_fallback',
        'get_tenant_service_with_fallback',
        'get_package_service_with_fallback',
        'get_infra_superadmin_service_with_fallback',
        'get_saved_search_service_with_fallback',
    ]
    
    print("\n1. 检查 auth.py 中的路由函数")
    print("-" * 60)
    from infra.api.auth import auth
    
    auth_functions = [
        'login', 'register', 'guest_login', 'register_personal', 
        'register_organization', 'get_current_user_info'
    ]
    
    for func_name in auth_functions:
        if hasattr(auth, func_name):
            func = getattr(auth, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # 检查是否有依赖注入参数
            has_di = any('auth_service' in param for param in params)
            if has_di:
                print(f"✅ {func_name} - 使用依赖注入 (参数: {[p for p in params if 'service' in p]})")
            else:
                print(f"❌ {func_name} - 未使用依赖注入")
    
    print("\n2. 检查 tenants.py 中的路由函数")
    print("-" * 60)
    from infra.api.tenants import tenants
    
    tenant_functions = [
        'list_tenants_for_superadmin', 'get_tenant_detail_for_superadmin',
        'approve_tenant_registration', 'reject_tenant_registration',
        'activate_tenant_by_superadmin', 'deactivate_tenant_by_superadmin',
        'create_tenant_by_superadmin', 'update_tenant_by_superadmin',
        'delete_tenant_by_superadmin'
    ]
    
    for func_name in tenant_functions:
        if hasattr(tenants, func_name):
            func = getattr(tenants, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # 检查是否有依赖注入参数
            has_di = any('tenant_service' in param for param in params)
            if has_di:
                print(f"✅ {func_name} - 使用依赖注入 (参数: {[p for p in params if 'service' in p]})")
            else:
                print(f"❌ {func_name} - 未使用依赖注入")
    
    print("\n3. 检查 packages.py 中的路由函数")
    print("-" * 60)
    from infra.api.packages import packages
    
    package_functions = [
        'list_packages', 'get_package_detail', 'create_package',
        'update_package', 'delete_package'
    ]
    
    for func_name in package_functions:
        if hasattr(packages, func_name):
            func = getattr(packages, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # 检查是否有依赖注入参数
            has_di = any('package_service' in param for param in params)
            if has_di:
                print(f"✅ {func_name} - 使用依赖注入 (参数: {[p for p in params if 'service' in p]})")
            else:
                print(f"❌ {func_name} - 未使用依赖注入")
    
    print("\n4. 检查 infra_superadmin.py 中的路由函数")
    print("-" * 60)
    from infra.api.infra_superadmin import infra_superadmin
    
    admin_functions = [
        'create_infra_superadmin', 'update_infra_superadmin'
    ]
    
    for func_name in admin_functions:
        if hasattr(infra_superadmin, func_name):
            func = getattr(infra_superadmin, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # 检查是否有依赖注入参数
            has_di = any('admin_service' in param for param in params)
            if has_di:
                print(f"✅ {func_name} - 使用依赖注入 (参数: {[p for p in params if 'service' in p]})")
            else:
                print(f"❌ {func_name} - 未使用依赖注入")
    
    print("\n5. 检查 saved_searches.py 中的路由函数")
    print("-" * 60)
    from infra.api.saved_searches import saved_searches
    
    saved_search_functions = [
        'list_saved_searches', 'create_saved_search', 'get_saved_search',
        'update_saved_search', 'delete_saved_search'
    ]
    
    for func_name in saved_search_functions:
        if hasattr(saved_searches, func_name):
            func = getattr(saved_searches, func_name)
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # 检查是否有依赖注入参数
            has_di = any('saved_search_service' in param for param in params)
            if has_di:
                print(f"✅ {func_name} - 使用依赖注入 (参数: {[p for p in params if 'service' in p]})")
            else:
                print(f"❌ {func_name} - 未使用依赖注入")
    
    print("\n" + "=" * 60)
    print("✅ 检查完成！")
    print("=" * 60)

if __name__ == "__main__":
    check_dependency_injection()

