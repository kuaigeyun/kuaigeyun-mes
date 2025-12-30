#!/usr/bin/env python3
"""
应用注册状态诊断脚本

用于诊断master-data应用是否正确注册
"""

import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def diagnose_app_registration():
    """诊断应用注册状态"""
    print("🔍 开始诊断应用注册状态...")

    try:
        # 1. 检查模块导入
        print("\n1. 检查模块导入...")
        try:
            import apps.master_data.api.router
            router = apps.master_data.api.router.router
            print(f"✅ master_data router 导入成功")
            print(f"   前缀: {router.prefix}")
            print(f"   路由数量: {len(router.routes)}")
            print(f"   路由列表:")
            for i, route in enumerate(router.routes[:5]):  # 只显示前5个
                print(f"     {i+1}. {route.methods} {route.path}")
        except Exception as e:
            print(f"❌ master_data router 导入失败: {e}")
            return

        # 2. 检查应用注册服务
        print("\n2. 检查应用注册服务...")
        try:
            from core.services.application.application_registry_service import ApplicationRegistryService

            # 尝试发现应用
            installed_apps = await ApplicationRegistryService._discover_installed_apps()
            print(f"📋 发现 {len(installed_apps)} 个已安装应用")

            master_data_app = None
            for app in installed_apps:
                if app.get('code') == 'master-data':
                    master_data_app = app
                    break

            if master_data_app:
                print(f"✅ 找到master-data应用: {master_data_app.get('name')}")
                print(f"   代码: {master_data_app.get('code')}")
                print(f"   路由路径: {master_data_app.get('route_path')}")
                print(f"   入口点: {master_data_app.get('entry_point')}")
                print(f"   已安装: {master_data_app.get('is_installed')}")
                print(f"   已激活: {master_data_app.get('is_active')}")
            else:
                print("❌ 未找到master-data应用")

        except Exception as e:
            print(f"❌ 应用注册服务检查失败: {e}")
            import traceback
            traceback.print_exc()

        # 3. 检查路由注册状态
        print("\n3. 检查路由注册状态...")
        try:
            registered_routes = ApplicationRegistryService.get_registered_routes()
            if 'master-data' in registered_routes:
                routers = registered_routes['master-data']
                print(f"✅ master-data路由已注册: {len(routers)} 个路由器")
                for router in routers:
                    print(f"   路由器前缀: {router.prefix}")
            else:
                print("❌ master-data路由未注册")
                print(f"已注册的应用: {list(registered_routes.keys())}")

        except Exception as e:
            print(f"❌ 路由注册状态检查失败: {e}")

    except Exception as e:
        print(f"❌ 诊断过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(diagnose_app_registration())

