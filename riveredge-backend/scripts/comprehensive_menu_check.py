"""
全面检查所有应用菜单的显示情况
包括：manifest.json、数据库、翻译文件、硬编码映射
"""

import asyncio
import sys
import json
import re
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from core.models.menu import Menu
from infra.infrastructure.database.database import TORTOISE_ORM

# 项目根目录
frontend_root = project_root.parent / "riveredge-frontend"

def parse_translation_file(file_path):
    """解析翻译文件，提取翻译 key"""
    translations = {}
    if not file_path.exists():
        return translations
    
    content = file_path.read_text(encoding='utf-8')
    # 提取 'key': 'value' 格式
    pattern = r"'([^']+)':\s*'([^']*)'"
    matches = re.findall(pattern, content)
    for key, value in matches:
        translations[key] = value
    
    return translations

def extract_menu_items(items, parent_path=""):
    """递归提取所有菜单项"""
    result = []
    for item in items:
        title = item.get("title", "")
        path = item.get("path", "")
        full_path = path if path else parent_path
        
        if path:
            result.append({
                "title": title,
                "path": path
            })
        
        if "children" in item:
            result.extend(extract_menu_items(item["children"], full_path))
    
    return result

def generate_translation_key(path):
    """根据路径生成翻译 key"""
    if not path or not path.startswith('/apps/'):
        return None
    
    parts = path.replace('/apps/', '').split('/')
    if len(parts) < 2:
        return None
    
    app_code = parts[0]
    relative_path = '/'.join(parts[1:])
    menu_path_key = relative_path.replace('/', '.')
    return f'app.{app_code}.menu.{menu_path_key}'

async def comprehensive_check():
    """全面检查"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    try:
        # 读取 manifest.json
        manifest_path = project_root / "src" / "apps" / "master_data" / "manifest.json"
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        menu_config = manifest.get("menu_config", {})
        all_menu_items = extract_menu_items(menu_config.get("children", []))
        
        # 读取翻译文件
        zh_cn_translations = parse_translation_file(frontend_root / "src" / "locales" / "zh-CN.ts")
        en_us_translations = parse_translation_file(frontend_root / "src" / "locales" / "en-US.ts")
        
        # 读取硬编码映射
        menu_translation_path = frontend_root / "src" / "utils" / "menuTranslation.ts"
        chinese_path_map = {}
        if menu_translation_path.exists():
            content = menu_translation_path.read_text(encoding='utf-8')
            # 提取 chinesePathMap
            map_match = re.search(r"chinesePathMap:\s*Record<string,\s*string>\s*=\s*\{([^}]+)\}", content, re.DOTALL)
            if map_match:
                map_content = map_match.group(1)
                pattern = r"'([^']+)':\s*'([^']*)'"
                matches = re.findall(pattern, map_content)
                for key, value in matches:
                    chinese_path_map[key] = value
        
        # 获取数据库菜单
        db_menus = await Menu.filter(
            tenant_id=1,
            application_uuid='df31f29d-50ce-4679-b3d5-e823e447f9ba',
            deleted_at__isnull=True
        ).all()
        
        db_menu_map = {menu.path: menu.name for menu in db_menus if menu.path}
        
        print("=" * 120)
        print("应用菜单全面显示检查报告")
        print("=" * 120)
        
        print(f"\n{'菜单名称':<20} | {'路径':<45} | {'manifest':<20} | {'数据库':<20} | {'zh-CN翻译':<20} | {'硬编码映射':<20}")
        print("-" * 120)
        
        issues = []
        
        for item in all_menu_items:
            title = item['title']
            path = item['path']
            translation_key = generate_translation_key(path)
            
            # 获取各处的值
            manifest_title = title
            db_title = db_menu_map.get(path, '❌不存在')
            zh_cn_title = zh_cn_translations.get(translation_key, '❌缺失') if translation_key else 'N/A'
            
            # 获取硬编码映射值
            segment = path.split('/')[-1] if path else ''
            hardcoded_title = chinese_path_map.get(segment, '❌缺失')
            
            # 检查一致性
            all_values = [v for v in [manifest_title, db_title, zh_cn_title, hardcoded_title] if v and not v.startswith('❌') and v != 'N/A']
            is_consistent = len(set(all_values)) <= 1 if all_values else False
            
            status = '✅' if is_consistent else '⚠️'
            
            print(f"{title:<20} | {path:<45} | {manifest_title:<20} | {db_title:<20} | {zh_cn_title:<20} | {hardcoded_title:<20} {status}")
            
            if not is_consistent:
                issues.append({
                    'title': title,
                    'path': path,
                    'manifest': manifest_title,
                    'database': db_title,
                    'zh_cn': zh_cn_title,
                    'hardcoded': hardcoded_title
                })
        
        if issues:
            print(f"\n⚠️  发现 {len(issues)} 个不一致的菜单:")
            for issue in issues:
                print(f"\n  {issue['title']} ({issue['path']}):")
                print(f"    manifest.json: {issue['manifest']}")
                print(f"    数据库:        {issue['database']}")
                print(f"    zh-CN翻译:    {issue['zh_cn']}")
                print(f"    硬编码映射:    {issue['hardcoded']}")
        else:
            print(f"\n✅ 所有菜单显示一致！")
        
    finally:
        await Tortoise.close_connections()

if __name__ == "__main__":
    asyncio.run(comprehensive_check())
