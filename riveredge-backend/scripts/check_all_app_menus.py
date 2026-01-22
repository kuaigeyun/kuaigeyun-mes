"""
全面检查所有应用级APP的菜单显示情况
包括：数据库、manifest.json、翻译文件等
"""

import asyncio
import sys
import json
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.menu import Menu
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_all_app_menus():
    """检查所有应用菜单"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 读取 manifest.json
        manifest_path = project_root / "src" / "apps" / "master_data" / "manifest.json"
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        menu_config = manifest.get("menu_config", {})
        
        print("=" * 80)
        print("应用菜单全面检查报告")
        print("=" * 80)
        
        # 递归提取所有菜单项
        def extract_menu_items(items, parent_path=""):
            result = []
            for item in items:
                title = item.get("title", "")
                path = item.get("path", "")
                full_path = path if path else parent_path
                
                if path:  # 有路径的才是实际菜单项
                    result.append({
                        "title": title,
                        "path": path,
                        "parent_path": parent_path
                    })
                
                if "children" in item:
                    result.extend(extract_menu_items(item["children"], full_path))
            
            return result
        
        all_menu_items = extract_menu_items(menu_config.get("children", []))
        
        print(f"\n📋 manifest.json 中的菜单配置（共 {len(all_menu_items)} 项）:")
        for item in all_menu_items:
            print(f"  {item['title']:20} | {item['path']}")
        
        # 检查数据库中的菜单
        print(f"\n📊 数据库中的菜单（tenant_id=1, application_uuid={manifest.get('code', 'master-data')}）:")
        db_menus = await Menu.filter(
            tenant_id=1,
            application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
            deleted_at__isnull=True
        ).order_by('sort_order').all()
        
        print(f"  共 {len(db_menus)} 个菜单项:")
        for menu in db_menus:
            parent_info = f" (parent_id: {menu.parent_id})" if menu.parent_id else " (根菜单)"
            print(f"  {menu.name:20} | {menu.path or '(无路径)':40} | sort_order: {menu.sort_order}{parent_info}")
        
        # 检查菜单匹配情况
        print(f"\n🔍 菜单匹配检查:")
        manifest_paths = {item['path']: item['title'] for item in all_menu_items if item['path']}
        db_paths = {menu.path: menu.name for menu in db_menus if menu.path}
        
        # 检查 manifest.json 中有但数据库中没有的
        missing_in_db = set(manifest_paths.keys()) - set(db_paths.keys())
        if missing_in_db:
            print(f"  ⚠️  manifest.json 中有但数据库中没有的菜单:")
            for path in missing_in_db:
                print(f"    {manifest_paths[path]:20} | {path}")
        
        # 检查数据库中有但 manifest.json 中没有的
        missing_in_manifest = set(db_paths.keys()) - set(manifest_paths.keys())
        if missing_in_manifest:
            print(f"  ⚠️  数据库中有但 manifest.json 中没有的菜单:")
            for path in missing_in_manifest:
                print(f"    {db_paths[path]:20} | {path}")
        
        # 检查名称不一致的
        print(f"\n📝 名称一致性检查:")
        common_paths = set(manifest_paths.keys()) & set(db_paths.keys())
        mismatches = []
        for path in common_paths:
            if manifest_paths[path] != db_paths[path]:
                mismatches.append({
                    "path": path,
                    "manifest": manifest_paths[path],
                    "database": db_paths[path]
                })
        
        if mismatches:
            print(f"  ⚠️  发现 {len(mismatches)} 个名称不一致的菜单:")
            for m in mismatches:
                print(f"    {m['path']}")
                print(f"      manifest.json: {m['manifest']}")
                print(f"      数据库:        {m['database']}")
        else:
            print(f"  ✅ 所有菜单名称一致")
        
        # 检查翻译文件
        print(f"\n🌐 翻译文件检查:")
        zh_cn_path = project_root.parent / "riveredge-frontend" / "src" / "locales" / "zh-CN.ts"
        en_us_path = project_root.parent / "riveredge-frontend" / "src" / "locales" / "en-US.ts"
        
        if zh_cn_path.exists():
            print(f"  ✅ zh-CN.ts 存在")
        else:
            print(f"  ❌ zh-CN.ts 不存在")
        
        if en_us_path.exists():
            print(f"  ✅ en-US.ts 存在")
        else:
            print(f"  ❌ en-US.ts 不存在")
        
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_all_app_menus())
