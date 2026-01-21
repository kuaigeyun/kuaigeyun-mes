"""
同步 master-data 应用的菜单配置到数据库

从后端的 manifest.json 文件读取菜单配置并更新到数据库
"""

import asyncio
import json
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.application import Application
from core.services.application.application_service import ApplicationService
from core.services.system.menu_service import MenuService
from infra.infrastructure.database.database import TORTOISE_ORM


async def sync_master_data_menu(tenant_id: int = 1):
    """
    从 manifest.json 同步菜单配置到数据库
    
    Args:
        tenant_id: 组织ID（默认 1）
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        app_code = "master-data"
        
        # 获取应用
        app = await Application.filter(
            tenant_id=tenant_id,
            code=app_code,
            deleted_at__isnull=True
        ).first()
        
        if not app:
            print(f"❌ 应用 {app_code} 不存在")
            return
        
        print(f"✅ 找到应用: {app.name} (UUID: {app.uuid})")
        
        # 读取后端的 manifest.json
        manifest_path = project_root / "src" / "apps" / "master_data" / "manifest.json"
        if not manifest_path.exists():
            print(f"❌ manifest.json 文件不存在: {manifest_path}")
            return
        
        print(f"📄 读取 manifest.json: {manifest_path}")
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        if "menu_config" not in manifest or not manifest["menu_config"]:
            print(f"⚠️ 应用 {app_code} 没有菜单配置")
            return
        
        menu_config = manifest["menu_config"]
        version = manifest.get("version", app.version)
        
        print(f"📋 菜单配置:")
        print(json.dumps(menu_config, ensure_ascii=False, indent=2))
        
        # 更新应用配置
        from core.schemas.application import ApplicationUpdate
        update_data = ApplicationUpdate(
            menu_config=menu_config,
            version=version
        )
        
        updated_app = await ApplicationService.update_application(
            tenant_id=tenant_id,
            uuid=str(app.uuid),
            data=update_data
        )
        
        print(f"✅ 已更新应用配置到数据库")
        
        # 同步菜单到菜单表
        updated_count = await MenuService.sync_menus_from_application_config(
            tenant_id=tenant_id,
            application_uuid=str(app.uuid),
            menu_config=menu_config,
            is_active=app.is_active
        )
        
        print(f"✅ 已同步菜单到数据库，更新了 {updated_count} 个菜单项")
        
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    tenant_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    await sync_master_data_menu(tenant_id)


if __name__ == "__main__":
    asyncio.run(main())
