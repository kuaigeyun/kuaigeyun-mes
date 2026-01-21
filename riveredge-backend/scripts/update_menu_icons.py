"""
更新所有应用的菜单图标

根据菜单表达的意图选择合适的 lucide 图标
- 只有一级菜单（显示在左侧菜单上的）才需要图标
- 下级菜单都不需要图标
- 同一个APP内不要有重复的图标
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Set

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

# Lucide 图标映射（根据菜单意图选择合适的图标）
# 参考：https://lucide.dev/icons/
# 注意：图标名称必须与 manufacturingIcons.tsx 中的键名匹配
ICON_MAPPING = {
    # MES 相关
    "生产订单": "order",
    "工单管理": "clipboard-list",
    "生产报工": "clipboard-check",
    "质量追溯": "search",
    "返工管理": "history",
    "资源分配": "users",
    
    # APS 相关
    "产能规划": "trending-up",
    "生产计划": "calendar",
    "资源调度": "network",
    "计划调整": "edit",
    
    # WMS 相关
    "库存管理": "database",
    "入库管理": "download",  # 使用 download 图标（向下箭头）
    "出库管理": "upload",  # 使用 upload 图标（向上箭头）
    "委外物料": "refresh-cw",  # 使用 refresh-cw 图标（循环）
    "库位管理": "map-pin",
    "内部物流": "truck",
    
    # QMS 相关
    "质量检验": "clipboard-check",
    "不合格品": "times-circle",
    "ISO体系": "shield",
    "质量分析": "bar-chart-3",
    
    # CRM 相关
    "线索管理": "user-plus",
    "商机管理": "trending-up",
    "销售漏斗": "funnel",
    "销售订单": "shopping-cart",
    "客户服务": "headphones",
    "销售分析": "bar-chart-3",
    "客户管理": "users",
    "销售管理": "shopping-cart",
    "服务管理": "users",
    "合同管理": "file-text",
    
    # PDM 相关
    "设计变更": "edit",
    "工程变更": "refresh-cw",
    "设计评审": "clipboard-check",
    "研发流程": "workflow",
    "知识管理": "book",
    "产品管理": "package",
    "设计管理": "edit",
    "变更管理": "history",
    "文档管理": "file-code",
    
    # EAM 相关
    "维护管理": "wrench",
    "故障管理": "alert-circle",
    "备件管理": "box",
    "工装夹具": "tool",
    "模具管理": "hammer",
    "设备管理": "cog",
    
    # 通用关键词（用于部分匹配）
    "订单": "order",
    "工单": "clipboard-list",
    "报工": "clipboard-check",
    "追溯": "search",
    "返工": "history",
    "资源": "users",
    "计划": "calendar",
    "调度": "network",
    "调整": "edit",
    "库存": "database",
    "入库": "download",  # 使用 download 图标
    "出库": "upload",  # 使用 upload 图标
    "库位": "map-pin",
    "物流": "truck",
    "检验": "clipboard-check",
    "质量": "shield",
    "分析": "bar-chart-3",
    "管理": "settings",
    "配置": "settings-2",
    "设置": "cog",
    "客户": "users",
    "销售": "shopping-cart",
    "商机": "trending-up",
    "服务": "headphones",
    "线索": "user-plus",
    "漏斗": "funnel",
    "合同": "file-text",
    "产品": "package",
    "设计": "edit",
    "变更": "history",
    "文档": "file-code",
    "设备": "cog",
    "维护": "wrench",
    "备件": "box",
    "故障": "alert-circle",
}


def find_icon_for_menu(menu_title: str, used_icons: Set[str]) -> str:
    """
    为菜单找到合适的图标
    
    Args:
        menu_title: 菜单标题
        used_icons: 已使用的图标集合
        
    Returns:
        str: 图标名称
    """
    # 首先尝试精确匹配
    if menu_title in ICON_MAPPING:
        icon = ICON_MAPPING[menu_title]
        if icon not in used_icons:
            return icon
    
    # 尝试部分匹配
    for key, icon in ICON_MAPPING.items():
        if key in menu_title and icon not in used_icons:
            return icon
    
    # 如果都匹配不上，使用默认图标（确保不重复）
    # 使用 manufacturingIcons.tsx 中存在的图标
    default_icons = [
        "list", "grid", "layout", 
        "package", "database", "users", "calendar", 
        "file-text", "clipboard-list", "trending-up", "network",
        "settings", "box", "edit", "search", "bar-chart-3",
        "file-code", "folder", "file"
    ]
    for icon in default_icons:
        if icon not in used_icons:
            return icon
    
    # 如果所有默认图标都用完了，返回第一个
    return "settings"


def update_menu_icons(menu_config: Dict[str, Any], is_root: bool = True) -> None:
    """
    递归更新菜单图标
    
    Args:
        menu_config: 菜单配置字典
        is_root: 是否为根菜单
    """
    if "children" not in menu_config or not menu_config["children"]:
        return
    
    # 收集一级菜单的标题
    first_level_menus = menu_config["children"]
    used_icons: Set[str] = set()
    
    # 为一级菜单分配图标
    for menu in first_level_menus:
        menu_title = menu.get("title", "")
        icon = find_icon_for_menu(menu_title, used_icons)
        menu["icon"] = icon
        used_icons.add(icon)
        
        # 递归处理子菜单，移除它们的图标
        if "children" in menu and menu["children"]:
            for child in menu["children"]:
                # 移除子菜单的图标
                if "icon" in child:
                    del child["icon"]
                # 递归处理更深层的子菜单
                if "children" in child:
                    update_menu_icons({"children": child["children"]}, is_root=False)


def update_manifest_icons(manifest_path: Path) -> bool:
    """
    更新单个 manifest.json 的菜单图标
    
    Args:
        manifest_path: manifest.json 文件路径
        
    Returns:
        bool: 是否成功更新
    """
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        if "menu_config" not in manifest:
            print(f"⚠️ {manifest_path.name}: 没有 menu_config")
            return False
        
        menu_config = manifest["menu_config"]
        update_menu_icons(menu_config)
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=4)
        
        print(f"✅ {manifest_path.name}: 已更新图标")
        return True
        
    except Exception as e:
        print(f"❌ {manifest_path.name}: 更新失败 - {e}")
        return False


def main():
    """主函数"""
    apps_dir = project_root / "src" / "apps"
    
    if not apps_dir.exists():
        print(f"❌ 应用目录不存在: {apps_dir}")
        sys.exit(1)
    
    manifest_files = list(apps_dir.glob("*/manifest.json"))
    
    if not manifest_files:
        print("❌ 没有找到任何 manifest.json 文件")
        sys.exit(1)
    
    print(f"📦 找到 {len(manifest_files)} 个应用")
    print("=" * 60)
    
    success_count = 0
    failed_count = 0
    
    for manifest_path in sorted(manifest_files):
        if update_manifest_icons(manifest_path):
            success_count += 1
        else:
            failed_count += 1
    
    print("=" * 60)
    print(f"✅ 成功更新: {success_count} 个应用")
    if failed_count > 0:
        print(f"❌ 失败: {failed_count} 个应用")


if __name__ == "__main__":
    main()

