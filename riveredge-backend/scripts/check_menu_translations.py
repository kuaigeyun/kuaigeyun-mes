"""
检查所有菜单的翻译 key 是否完整
"""

import json
from pathlib import Path

# 项目根目录
project_root = Path(__file__).parent.parent
frontend_root = project_root.parent / "riveredge-frontend"

# 读取 manifest.json
manifest_path = project_root / "src" / "apps" / "master_data" / "manifest.json"
with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

# 读取翻译文件
zh_cn_path = frontend_root / "src" / "locales" / "zh-CN.ts"
en_us_path = frontend_root / "src" / "locales" / "en-US.ts"

# 解析翻译文件（简单解析，提取翻译 key）
def parse_translation_file(file_path):
    """解析翻译文件，提取翻译 key"""
    translations = {}
    if not file_path.exists():
        return translations
    
    content = file_path.read_text(encoding='utf-8')
    # 简单正则提取 'key': 'value' 格式
    import re
    pattern = r"'([^']+)':\s*'([^']*)'"
    matches = re.findall(pattern, content)
    for key, value in matches:
        translations[key] = value
    
    return translations

zh_cn_translations = parse_translation_file(zh_cn_path)
en_us_translations = parse_translation_file(en_us_path)

# 提取所有菜单项
def extract_menu_items(items, parent_path=""):
    result = []
    for item in items:
        title = item.get("title", "")
        path = item.get("path", "")
        full_path = path if path else parent_path
        
        if path:  # 有路径的才是实际菜单项
            result.append({
                "title": title,
                "path": path
            })
        
        if "children" in item:
            result.extend(extract_menu_items(item["children"], full_path))
    
    return result

all_menu_items = extract_menu_items(manifest.get("menu_config", {}).get("children", []))

print("=" * 100)
print("菜单翻译 Key 完整性检查")
print("=" * 100)

# 生成翻译 key
def generate_translation_key(path):
    """根据路径生成翻译 key"""
    if not path or not path.startswith('/apps/'):
        return None
    
    # 提取应用 code 和相对路径
    parts = path.replace('/apps/', '').split('/')
    if len(parts) < 2:
        return None
    
    app_code = parts[0]
    relative_path = '/'.join(parts[1:])
    
    # 生成翻译 key: app.{app-code}.menu.{menu-path}
    menu_path_key = relative_path.replace('/', '.')
    return f'app.{app_code}.menu.{menu_path_key}'

print(f"\n📋 菜单翻译 Key 检查（共 {len(all_menu_items)} 项）:\n")
print(f"{'菜单名称':<20} | {'路径':<50} | {'翻译 Key':<50} | {'zh-CN':<5} | {'en-US':<5}")
print("-" * 100)

missing_zh_cn = []
missing_en_us = []

for item in all_menu_items:
    title = item['title']
    path = item['path']
    translation_key = generate_translation_key(path)
    
    has_zh_cn = translation_key in zh_cn_translations if translation_key else False
    has_en_us = translation_key in en_us_translations if translation_key else False
    
    zh_cn_value = zh_cn_translations.get(translation_key, '') if translation_key else ''
    en_us_value = en_us_translations.get(translation_key, '') if translation_key else ''
    
    status_zh = '✅' if has_zh_cn else '❌'
    status_en = '✅' if has_en_us else '❌'
    
    print(f"{title:<20} | {path:<50} | {translation_key or '(N/A)':<50} | {status_zh:<5} | {status_en:<5}")
    
    if translation_key and not has_zh_cn:
        missing_zh_cn.append({
            'title': title,
            'path': path,
            'key': translation_key
        })
    
    if translation_key and not has_en_us:
        missing_en_us.append({
            'title': title,
            'path': path,
            'key': translation_key
        })

if missing_zh_cn:
    print(f"\n⚠️  缺少 zh-CN 翻译的菜单（{len(missing_zh_cn)} 项）:")
    for item in missing_zh_cn:
        print(f"  {item['key']}: '{item['title']}'")

if missing_en_us:
    print(f"\n⚠️  缺少 en-US 翻译的菜单（{len(missing_en_us)} 项）:")
    for item in missing_en_us:
        print(f"  {item['key']}: '{item['title']}'")

if not missing_zh_cn and not missing_en_us:
    print(f"\n✅ 所有菜单翻译 Key 完整！")
