"""
初始化快格轻MES应用脚本

使用自动扫描功能从 manifest.json 读取配置并注册插件应用。
支持为所有租户或指定租户初始化应用。
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.models.tenant import Tenant
from core.services.application_service import ApplicationService


async def init_kuaimes_application(tenant_id: int = None):
    """
    初始化快格轻MES应用
    
    使用自动扫描功能从 manifest.json 读取配置并注册插件应用。
    
    Args:
        tenant_id: 租户ID，如果为 None 则对所有租户初始化
    """
    # 初始化 Tortoise ORM
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        if tenant_id is None:
            # 为所有租户初始化
            tenants = await Tenant.all()
            if not tenants:
                print("⚠️ 未找到任何租户，请先创建租户")
                return
            
            print(f"📦 开始为 {len(tenants)} 个租户扫描并注册插件应用...\n")
            
            total_apps = 0
            for tenant in tenants:
                try:
                    apps = await ApplicationService.scan_and_register_plugins(tenant_id=tenant.id)
                    if apps:
                        print(f"✅ 租户 {tenant.name} (ID: {tenant.id}): 注册了 {len(apps)} 个插件应用")
                        for app in apps:
                            print(f"   - {app.name} (code: {app.code}, UUID: {app.uuid})")
                        total_apps += len(apps)
                    else:
                        print(f"ℹ️  租户 {tenant.name} (ID: {tenant.id}): 未发现新插件")
                except Exception as e:
                    print(f"❌ 租户 {tenant.name} (ID: {tenant.id}) 扫描失败: {e}")
                    import traceback
                    traceback.print_exc()
            
            print(f"\n✅ 完成！共为 {len(tenants)} 个租户注册了 {total_apps} 个插件应用")
            print(f"\n💡 提示: 应用已注册但未安装，请在应用中心安装并启用应用。")
        else:
            # 为指定租户初始化
            tenant = await Tenant.filter(id=tenant_id).first()
            if not tenant:
                print(f"❌ 租户 ID {tenant_id} 不存在")
                return
            
            print(f"📦 开始为租户 {tenant.name} (ID: {tenant_id}) 扫描并注册插件应用...\n")
            
            apps = await ApplicationService.scan_and_register_plugins(tenant_id=tenant_id)
            if apps:
                print(f"✅ 成功注册了 {len(apps)} 个插件应用:")
                for app in apps:
                    print(f"   - {app.name} (code: {app.code}, UUID: {app.uuid})")
                    print(f"     路由路径: {app.route_path}")
                    print(f"     入口点: {app.entry_point}")
                print(f"\n💡 提示: 应用已注册但未安装，请在应用中心安装并启用应用。")
            else:
                print(f"ℹ️  未发现新插件")
        
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="初始化快格轻MES应用")
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=None,
        help="租户ID，如果不指定则对所有租户初始化"
    )
    args = parser.parse_args()
    
    asyncio.run(init_kuaimes_application(tenant_id=args.tenant_id))

