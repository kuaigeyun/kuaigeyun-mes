"""
检查所有应用的菜单英文翻译完整性
"""

import json
import re
from pathlib import Path

# 项目根目录
project_root = Path(__file__).parent.parent
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

def extract_menu_items(items, parent_path="", app_code=""):
    """递归提取所有菜单项"""
    result = []
    for item in items:
        title = item.get("title", "")
        path = item.get("path", "")
        full_path = path if path else parent_path
        
        if path:
            # 生成翻译 key
            if path.startswith('/apps/'):
                parts = path.replace('/apps/', '').split('/')
                if len(parts) >= 2:
                    app = parts[0]
                    relative_path = '/'.join(parts[1:])
                    menu_path_key = relative_path.replace('/', '.')
                    translation_key = f'app.{app}.menu.{menu_path_key}'
                else:
                    translation_key = None
            else:
                translation_key = None
            
            result.append({
                "title": title,
                "path": path,
                "translation_key": translation_key
            })
        
        if "children" in item:
            result.extend(extract_menu_items(item["children"], full_path, app_code))
    
    return result

def check_all_apps():
    """检查所有应用的菜单翻译"""
    # 查找所有 manifest.json
    apps_dir = project_root / "src" / "apps"
    manifest_files = list(apps_dir.glob("*/manifest.json"))
    
    # 读取翻译文件
    zh_cn_translations = parse_translation_file(frontend_root / "src" / "locales" / "zh-CN.ts")
    en_us_translations = parse_translation_file(frontend_root / "src" / "locales" / "en-US.ts")
    
    print("=" * 120)
    print("所有应用菜单英文翻译检查报告")
    print("=" * 120)
    
    all_issues = []
    
    for manifest_file in manifest_files:
        app_name = manifest_file.parent.name
        print(f"\n📦 应用: {app_name}")
        
        with open(manifest_file, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        menu_config = manifest.get("menu_config", {})
        all_menu_items = extract_menu_items(menu_config.get("children", []))
        
        app_issues = []
        
        for item in all_menu_items:
            title = item['title']
            path = item['path']
            translation_key = item['translation_key']
            
            has_zh_cn = translation_key in zh_cn_translations if translation_key else False
            has_en_us = translation_key in en_us_translations if translation_key else False
            
            zh_cn_value = zh_cn_translations.get(translation_key, '') if translation_key else ''
            en_us_value = en_us_translations.get(translation_key, '') if translation_key else ''
            
            if not has_en_us and translation_key:
                app_issues.append({
                    'title': title,
                    'path': path,
                    'translation_key': translation_key,
                    'zh_cn': zh_cn_value
                })
                print(f"  ❌ {title:<30} | {path:<50} | Key: {translation_key}")
        
        if not app_issues:
            print(f"  ✅ 所有菜单翻译完整")
        else:
            all_issues.extend(app_issues)
    
    if all_issues:
        print(f"\n\n⚠️  发现 {len(all_issues)} 个缺失英文翻译的菜单:")
        print("\n需要添加到 en-US.ts 的翻译:")
        print("-" * 120)
        for issue in all_issues:
            print(f"  '{issue['translation_key']}': '{issue['title']}',  // {issue['path']}")
    else:
        print(f"\n✅ 所有应用菜单英文翻译完整！")
    
    return all_issues

if __name__ == "__main__":
    check_all_apps()
