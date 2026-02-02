import asyncio
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
current_dir = Path(__file__).resolve().parent
backend_src = current_dir.parent / "src"
sys.path.insert(0, str(backend_src))

from core.services.application.application_service import ApplicationService
from infra.infrastructure.database.database import get_db_connection, register_db
from tortoise import Tortoise
from fastapi import FastAPI

async def init_tortoise():
    """初始化 Tortoise ORM"""
    # 模拟 FastAPI 应用以利用现有注册逻辑
    app = FastAPI()
    await register_db(app)

async def sync_all_tenants():
    """同步所有租户的应用清单和菜单"""
    print("🔄 开始为所有租户同步应用清单...")
    
    # 1. 初始化数据库
    try:
        await init_tortoise()
        print("✅ 数据库 ORM 已初始化")
    except Exception as e:
        print(f"❌ 数据库 ORM 初始化失败: {e}")
        return

    try:
        # 2. 获取所有租户ID
        conn = await get_db_connection()
        tenants = await conn.fetch("SELECT id, name FROM infra_tenants")
        await conn.close()
        
        for tenant in tenants:
            tenant_id = tenant['id']
            tenant_name = tenant['name']
            print(f"\n🏢 正在为租户同步: {tenant_name} (ID: {tenant_id})")
            
            try:
                # 调用系统服务进行扫描和注册
                # 这会自动读取 manifest.json 并同步菜单
                registered_apps = await ApplicationService.scan_and_register_plugins(tenant_id=tenant_id)
                print(f"✅ 已成功扫描并同步 {len(registered_apps)} 个应用")
                
                # 特别显示快格轻制造的状态
                k_app = next((app for app in registered_apps if app.get('code') == 'kuaizhizao'), None)
                if k_app:
                    print(f"   💡 快格轻制造同步成功 V{k_app.get('version')}")
                    
            except Exception as e:
                print(f"❌ 为租户 {tenant_id} 同步时出错: {e}")
                import traceback
                traceback.print_exc()
                
        print("\n✨ 所有租户同步完成！")
        
    except Exception as e:
        print(f"❌ 同步过程发生严重错误: {e}")
    finally:
        # 3. 关闭连接
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(sync_all_tenants())
