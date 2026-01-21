"""
从数据库同步菜单配置到 manifest.json

用法:
    python scripts/sync_menu_from_db.py kuaimes
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


def menu_to_dict(menu: Menu, app_root_path: str = None) -> Dict[str, Any]:
    """
    将菜单对象转换为字典（manifest.json 格式）
    
    Args:
        menu: 菜单对象
        app_root_path: 应用根路径（用于过滤仪表板菜单）
        
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
    
    # 处理子菜单（递归过滤仪表板菜单）
    if hasattr(menu, '_children') and menu._children:
        children = []
        for child in sorted(menu._children, key=lambda m: m.sort_order):
            # 过滤掉仪表板菜单
            if app_root_path and child.name == "仪表板" and child.path == app_root_path:
                continue
            child_dict = menu_to_dict(child, app_root_path)
            children.append(child_dict)
        if children:
            menu_dict["children"] = children
    
    return menu_dict


async def sync_menu_from_db(app_code: str, tenant_id: int = 1, init_db: bool = True):
    """
    从数据库同步菜单配置到 manifest.json
    
    Args:
        app_code: 应用代码（如 'kuaimes'）
        tenant_id: 组织ID（默认 1）
        init_db: 是否初始化数据库连接（批量处理时设为 False）
    """
    # 初始化数据库连接（如果尚未初始化）
    if init_db:
        await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取应用
        app = await get_application_by_code(tenant_id, app_code)
        if not app:
            print(f"❌ 应用 {app_code} 不存在")
            return
        
        print(f"✅ 找到应用: {app.name} (UUID: {app.uuid})")
        
        # 获取菜单树
        menus = await get_menu_tree_by_application(tenant_id, str(app.uuid), is_active=True)
        
        if not menus:
            print(f"⚠️ 应用 {app_code} 没有菜单数据")
            return
        
        print(f"✅ 找到 {len(menus)} 个根菜单")
        
        # 转换为 manifest.json 格式
        app_root_path = app.route_path or f"/apps/{app_code}"
        menu_config: Dict[str, Any] = {
            "title": app.name,
            "icon": app.icon,
            "path": app_root_path,
        }
        
        # 处理子菜单
        children = []
        for menu in sorted(menus, key=lambda m: m.sort_order):
            # 过滤掉仪表板菜单（title 为"仪表板"且 path 为应用根路径）
            if menu.name == "仪表板" and menu.path == app_root_path:
                print(f"⚠️ 跳过仪表板菜单: {menu.name}")
                continue
            
            menu_dict = menu_to_dict(menu, app_root_path)
            
            # 递归展开重复层级
            def expand_duplicate_levels(menu_dict_item: Dict[str, Any]) -> List[Dict[str, Any]]:
                """
                递归展开重复层级
                
                Args:
                    menu_dict_item: 菜单字典项
                    
                Returns:
                    List[Dict[str, Any]]: 展开后的菜单列表
                """
                if "children" not in menu_dict_item or not menu_dict_item["children"]:
                    return [menu_dict_item]
                
                # 如果只有一个子菜单，且名称和路径相同，则展开
                if (len(menu_dict_item["children"]) == 1 and
                    menu_dict_item["children"][0].get("title") == menu_dict_item.get("title") and
                    menu_dict_item["children"][0].get("path") == menu_dict_item.get("path")):
                    # 递归展开子菜单
                    return expand_duplicate_levels(menu_dict_item["children"][0])
                else:
                    # 递归处理所有子菜单
                    expanded_children = []
                    for child in menu_dict_item["children"]:
                        expanded_children.extend(expand_duplicate_levels(child))
                    result = menu_dict_item.copy()
                    result["children"] = expanded_children
                    return [result]
            
            # 展开重复层级
            expanded = expand_duplicate_levels(menu_dict)
            children.extend(expanded)
        
        # 清理重复层级：如果根菜单的 children 中只有一个，且名称和路径相同，则展开
        if children and len(children) == 1:
            first_child = children[0]
            if (first_child.get("title") == menu_config.get("title") and
                first_child.get("path") == menu_config.get("path") and
                "children" in first_child):
                # 直接使用子菜单的 children
                menu_config["children"] = first_child["children"]
            else:
                menu_config["children"] = children
        elif children:
            menu_config["children"] = children
        
        # 读取 manifest.json
        manifest_path = project_root / "src" / "apps" / app_code / "manifest.json"
        if not manifest_path.exists():
            print(f"❌ manifest.json 文件不存在: {manifest_path}")
            return
        
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        # 更新 menu_config
        manifest["menu_config"] = menu_config
        
        # 保存 manifest.json
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=4)
        
        print(f"✅ 已更新 manifest.json: {manifest_path}")
        print(f"📋 菜单配置:")
        print(json.dumps(menu_config, ensure_ascii=False, indent=2))
        
    finally:
        if init_db:
            await Tortoise.close_connections()


async def sync_all_apps_from_db(tenant_id: int = 1):
    """
    从数据库同步所有应用的菜单配置到 manifest.json
    
    Args:
        tenant_id: 组织ID（默认 1）
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 获取所有应用
        from core.services.application_service import ApplicationService
        applications = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=1000,
            is_installed=None,
            is_active=None
        )
        
        if not applications:
            print("❌ 没有找到任何应用")
            return
        
        print(f"✅ 找到 {len(applications)} 个应用")
        print("=" * 60)
        
        success_count = 0
        failed_count = 0
        
        for app in applications:
            app_code = app.get('code')
            if not app_code:
                print(f"⚠️ 跳过应用（缺少 code）: {app.get('name', 'unknown')}")
                continue
            
            print(f"\n📦 处理应用: {app.get('name')} (code: {app_code})")
            try:
                await sync_menu_from_db(app_code, tenant_id, init_db=False)
                success_count += 1
            except Exception as e:
                print(f"❌ 更新失败: {e}")
                failed_count += 1
                import traceback
                traceback.print_exc()
        
        print("\n" + "=" * 60)
        print(f"✅ 成功更新: {success_count} 个应用")
        if failed_count > 0:
            print(f"❌ 失败: {failed_count} 个应用")
        
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    tenant_id = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    if len(sys.argv) < 2:
        print("用法:")
        print("  python scripts/sync_menu_from_db.py <app_code> [tenant_id]  # 更新单个应用")
        print("  python scripts/sync_menu_from_db.py --all [tenant_id]     # 更新所有应用")
        print("\n示例:")
        print("  python scripts/sync_menu_from_db.py kuaimes 1")
        print("  python scripts/sync_menu_from_db.py --all 1")
        sys.exit(1)
    
    if sys.argv[1] == "--all":
        await sync_all_apps_from_db(tenant_id)
    else:
        app_code = sys.argv[1]
        await sync_menu_from_db(app_code, tenant_id)


if __name__ == "__main__":
    asyncio.run(main())

