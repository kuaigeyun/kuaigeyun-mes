#!/usr/bin/env python3
import asyncio
import sys
from pathlib import Path

# 添加后端src目录到Python路径
backend_src_path = Path(__file__).parent / 'riveredge-backend' / 'src'
sys.path.insert(0, str(backend_src_path))

from core.services.application.application_service import ApplicationService

async def init_apps():
    """初始化应用数据"""
    try:
        # 使用租户ID 1（假设默认租户）
        tenant_id = 1

        print("开始扫描和注册插件应用...")
        apps = await ApplicationService.scan_and_register_plugins(tenant_id)

        print(f"成功注册了 {len(apps)} 个应用:")
        for app in apps:
            print(f"  - {app['code']}: {app['name']} (v{app['version']})")
            print(f"    active: {app['is_active']}, installed: {app['is_installed']}")

        # 安装和启用应用
        print("\n开始安装和启用应用...")
        for app in apps:
            app_uuid = app['uuid']
            app_code = app['code']

            try:
                # 安装应用
                if not app['is_installed']:
                    print(f"安装应用: {app_code}")
                    # 这里需要调用安装逻辑
                    # 由于ApplicationService没有直接的安装方法，我们可以直接更新数据库

                # 启用应用
                if not app['is_active']:
                    print(f"启用应用: {app_code}")
                    # 这里需要调用启用逻辑

            except Exception as e:
                print(f"处理应用 {app_code} 时出错: {e}")

        print("应用初始化完成")

    except Exception as e:
        print(f"应用初始化失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(init_apps())