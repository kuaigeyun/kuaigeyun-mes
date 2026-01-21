"""
从 manifest.json 同步菜单图标到数据库

用法:
    python scripts/sync_menu_icons_to_db.py kuaiwms 1
    或
    python scripts/sync_menu_icons_to_db.py --all 1
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.application import Application
from core.services.application_service import ApplicationService
from core.services.menu_service import MenuService
from infra.infrastructure.database.database import TORTOISE_ORM


async def sync_menu_icons_to_db(app_code: str, tenant_id: int = 1):
    """
    从 manifest.json 同步菜单图标到数据库
    
    Args:
        app_code: 应用代码（如 'kuaiwms'）
        tenant_id: 组织ID（默认 1）
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
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
        
        # 读取 manifest.json
        manifest_path = project_root / "src" / "apps" / app_code / "manifest.json"
        if not manifest_path.exists():
            print(f"❌ manifest.json 文件不存在: {manifest_path}")
            return
        
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        if "menu_config" not in manifest or not manifest["menu_config"]:
            print(f"⚠️ 应用 {app_code} 没有菜单配置")
            return
        
        menu_config = manifest["menu_config"]
        
        # 同步菜单配置到数据库（这会更新图标）
        updated_count = await MenuService.sync_menus_from_application_config(
            tenant_id=tenant_id,
            application_uuid=str(app.uuid),
            menu_config=menu_config,
            is_active=app.is_active
        )
        
        print(f"✅ 已同步菜单图标到数据库，更新了 {updated_count} 个菜单项")
        
        # 显示更新的图标信息
        def print_menu_icons(menu_item: Dict[str, Any], level: int = 0):
            """递归打印菜单图标信息"""
            indent = "  " * level
            title = menu_item.get("title", menu_item.get("name", ""))
            icon = menu_item.get("icon", "无")
            path = menu_item.get("path", "")
            print(f"{indent}- {title}: {icon} ({path})")
            
            if "children" in menu_item and menu_item["children"]:
                for child in menu_item["children"]:
                    print_menu_icons(child, level + 1)
        
        print(f"\n📋 菜单图标配置:")
        print_menu_icons(menu_config)
        
    finally:
        await Tortoise.close_connections()


async def sync_all_app_menu_icons_to_db(tenant_id: int = 1):
    """
    同步所有应用的菜单图标到数据库
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取所有应用代码
        app_manifests = ApplicationService._scan_plugin_manifests()
        app_codes = [m['code'] for m in app_manifests if 'code' in m]
        
        print(f"✅ 找到 {len(app_codes)} 个应用")
        print("============================================================")
        
        for app_code in app_codes:
            print(f"\n📦 处理应用: {app_code}")
            await sync_menu_icons_to_db(app_code, tenant_id)
        
        print("\n============================================================")
        print(f"✅ 成功同步: {len(app_codes)} 个应用的菜单图标")
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    if "--all" in sys.argv:
        tenant_id_index = sys.argv.index("--all") + 1
        tenant_id = int(sys.argv[tenant_id_index]) if len(sys.argv) > tenant_id_index else 1
        await sync_all_app_menu_icons_to_db(tenant_id)
    elif len(sys.argv) >= 2:
        app_code = sys.argv[1]
        tenant_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        await sync_menu_icons_to_db(app_code, tenant_id)
    else:
        print("用法: python scripts/sync_menu_icons_to_db.py <app_code> [tenant_id]")
        print("或: python scripts/sync_menu_icons_to_db.py --all [tenant_id]")
        print("示例: python scripts/sync_menu_icons_to_db.py kuaiwms 1")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

