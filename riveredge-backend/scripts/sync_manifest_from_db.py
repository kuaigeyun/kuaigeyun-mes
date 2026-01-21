"""
从数据库反向同步数据到 manifest.json

用法:
    python scripts/sync_manifest_from_db.py kuaiwms 1
    或
    python scripts/sync_manifest_from_db.py --all 1
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
from core.models.menu import Menu
from core.models.application import Application
from infra.infrastructure.database.database import TORTOISE_ORM


async def get_application_by_code(tenant_id: int, code: str) -> Optional[Application]:
    """
    根据代码获取应用
    
    Args:
        tenant_id: 组织ID
        code: 应用代码
        
    Returns:
        Application: 应用对象，如果不存在返回 None
    """
    return await Application.filter(
        tenant_id=tenant_id,
        code=code,
        deleted_at__isnull=True
    ).first()


async def get_menu_tree_by_application(
    tenant_id: int,
    application_uuid: str,
    is_active: Optional[bool] = None
) -> List[Menu]:
    """
    获取应用的菜单树
    
    Args:
        tenant_id: 组织ID
        application_uuid: 应用UUID
        is_active: 是否启用过滤
        
    Returns:
        List[Menu]: 菜单列表（树形结构）
    """
    query = Menu.filter(
        tenant_id=tenant_id,
        application_uuid=application_uuid,
        deleted_at__isnull=True
    )
    
    if is_active is not None:
        query = query.filter(is_active=is_active)
    
    # 获取所有菜单
    all_menus = await query.order_by("sort_order", "created_at").all()
    
    # 构建菜单映射
    menu_map: Dict[int, Menu] = {menu.id: menu for menu in all_menus}
    root_menus: List[Menu] = []
    
    # 构建父子关系
    for menu in all_menus:
        if menu.parent_id:
            parent = menu_map.get(menu.parent_id)
            if parent:
                if not hasattr(parent, '_children'):
                    parent._children = []
                parent._children.append(menu)
        else:
            root_menus.append(menu)
    
    return root_menus


def menu_to_dict(menu: Menu) -> Dict[str, Any]:
    """
    将菜单对象转换为字典（manifest.json 格式）
    
    Args:
        menu: 菜单对象
        
    Returns:
        Dict[str, Any]: 菜单字典
    """
    menu_dict: Dict[str, Any] = {
        "title": menu.name,
        "path": menu.path,
    }
    
    if menu.icon:
        menu_dict["icon"] = menu.icon
    
    if menu.permission_code:
        menu_dict["permission"] = menu.permission_code
    
    if menu.sort_order and menu.sort_order != 0:
        menu_dict["sort_order"] = menu.sort_order
    
    # 处理子菜单
    children = []
    if hasattr(menu, '_children') and menu._children:
        for child in sorted(menu._children, key=lambda m: m.sort_order):
            child_dict = menu_to_dict(child)
            children.append(child_dict)
    
    if children:
        menu_dict["children"] = children
    
    return menu_dict


async def sync_manifest_from_db(app_code: str, tenant_id: int = 1):
    """
    从数据库同步数据到 manifest.json
    
    Args:
        app_code: 应用代码（如 'kuaiwms'）
        tenant_id: 组织ID（默认 1）
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取应用
        app = await get_application_by_code(tenant_id, app_code)
        if not app:
            print(f"❌ 应用 {app_code} 不存在")
            return
        
        print(f"✅ 找到应用: {app.name} (UUID: {app.uuid})")
        
        # 读取或创建 manifest.json
        # 注意：app_code 可能是 kebab-case（如 master-data），但目录可能是 snake_case（如 master_data）
        # 先尝试使用 app_code 作为目录名，如果不存在，尝试转换为 snake_case
        manifest_path = project_root / "src" / "apps" / app_code / "manifest.json"
        if not manifest_path.parent.exists():
            # 尝试转换为 snake_case（将连字符替换为下划线）
            snake_case_code = app_code.replace("-", "_")
            alt_manifest_path = project_root / "src" / "apps" / snake_case_code / "manifest.json"
            if alt_manifest_path.parent.exists():
                manifest_path = alt_manifest_path
                print(f"📁 使用目录: {snake_case_code} (app_code: {app_code})")
        
        manifest_dir = manifest_path.parent
        
        # 如果目录不存在，创建它
        manifest_dir.mkdir(parents=True, exist_ok=True)
        
        # 读取现有 manifest.json（如果存在）
        existing_manifest = {}
        if manifest_path.exists():
            with open(manifest_path, 'r', encoding='utf-8') as f:
                existing_manifest = json.load(f)
            print(f"📄 读取现有 manifest.json: {manifest_path}")
        else:
            print(f"📄 创建新的 manifest.json: {manifest_path}")
        
        # 获取菜单树
        menus = await get_menu_tree_by_application(tenant_id, str(app.uuid), is_active=True)
        
        # 构建 manifest.json
        manifest: Dict[str, Any] = {
            "name": app.name,
            "code": app.code,
            "version": app.version or existing_manifest.get("version", "1.0.0"),
            "description": app.description or existing_manifest.get("description", ""),
            "icon": app.icon or existing_manifest.get("icon", ""),
            "author": existing_manifest.get("author", "RiverEdge Team"),
            "entry_point": app.entry_point or existing_manifest.get("entry_point", f"../apps/{manifest_dir.name}/index.tsx"),
            "route_path": app.route_path or existing_manifest.get("route_path", f"/apps/{app_code}"),
        }
        
        # 添加 sort_order（如果存在）
        if app.sort_order and app.sort_order != 0:
            manifest["sort_order"] = app.sort_order
        
        # 构建 menu_config
        if menus:
            # 找到根菜单（通常是应用名称）
            root_menu = None
            for menu in menus:
                if menu.path == app.route_path or menu.path == f"/apps/{app_code}":
                    root_menu = menu
                    break
            
            if root_menu:
                # 使用根菜单作为 menu_config
                menu_config = menu_to_dict(root_menu)
            else:
                # 如果没有找到匹配的根菜单，使用第一个根菜单
                menu_config = menu_to_dict(menus[0])
            
            # 如果 menu_config 的 title 和 path 与应用根菜单相同，展开其子菜单
            if (menu_config.get("title") == app.name and 
                menu_config.get("path") == app.route_path and 
                menu_config.get("children")):
                # 展开子菜单
                manifest["menu_config"] = {
                    "title": app.name,
                    "icon": app.icon or menu_config.get("icon"),
                    "path": app.route_path or f"/apps/{app_code}",
                    "children": menu_config.get("children", [])
                }
            else:
                manifest["menu_config"] = menu_config
        else:
            # 如果没有菜单，使用应用信息作为根菜单
            manifest["menu_config"] = {
                "title": app.name,
                "icon": app.icon or "",
                "path": app.route_path or f"/apps/{app_code}",
                "children": []
            }
        
        # 保留现有的 permissions（如果存在）
        if "permissions" in existing_manifest:
            manifest["permissions"] = existing_manifest["permissions"]
        else:
            # 从菜单中提取权限
            all_menus = await Menu.filter(
                tenant_id=tenant_id,
                application_uuid=str(app.uuid),
                deleted_at__isnull=True
            ).all()
            permissions = []
            for menu in all_menus:
                if menu.permission_code:
                    permissions.append(menu.permission_code)
            if permissions:
                manifest["permissions"] = sorted(set(permissions))
        
        # 保留现有的 dependencies（如果存在）
        if "dependencies" in existing_manifest:
            manifest["dependencies"] = existing_manifest["dependencies"]
        else:
            manifest["dependencies"] = {
                "riveredge-backend": ">=1.0.0",
                "riveredge-frontend": ">=1.0.0"
            }
        
        # 保存 manifest.json
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=4)
        
        print(f"✅ 已更新 manifest.json: {manifest_path}")
        print(f"📋 应用信息:")
        print(f"   名称: {manifest['name']}")
        print(f"   代码: {manifest['code']}")
        print(f"   图标: {manifest['icon']}")
        print(f"   路由: {manifest['route_path']}")
        print(f"   菜单数量: {len(menus)} 个根菜单")
        
    finally:
        await Tortoise.close_connections()


async def sync_all_manifests_from_db(tenant_id: int = 1):
    """
    从数据库同步所有应用的 manifest.json
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取所有应用
        apps = await Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by("sort_order", "created_at").all()
        
        print(f"✅ 找到 {len(apps)} 个应用")
        print("=" * 80)
        
        for app in apps:
            print(f"\n📦 处理应用: {app.code} ({app.name})")
            await sync_manifest_from_db(app.code, tenant_id)
        
        print("\n" + "=" * 80)
        print(f"✅ 成功更新: {len(apps)} 个应用的 manifest.json")
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    if "--all" in sys.argv:
        tenant_id_index = sys.argv.index("--all") + 1
        tenant_id = int(sys.argv[tenant_id_index]) if len(sys.argv) > tenant_id_index else 1
        await sync_all_manifests_from_db(tenant_id)
    elif len(sys.argv) >= 2:
        app_code = sys.argv[1]
        tenant_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        await sync_manifest_from_db(app_code, tenant_id)
    else:
        print("用法: python scripts/sync_manifest_from_db.py <app_code> [tenant_id]")
        print("或: python scripts/sync_manifest_from_db.py --all [tenant_id]")
        print("示例: python scripts/sync_manifest_from_db.py kuaiwms 1")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

