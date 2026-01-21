"""
调试应用扫描脚本

检查应用扫描路径和扫描结果。

Author: Luigi Lu
Date: 2025-12-27
"""

import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from core.services.application.application_service import ApplicationService


def debug_scan_path():
    """调试扫描路径"""
    print("="*60)
    print("🔍 调试应用扫描路径")
    print("="*60)
    
    # 获取插件目录
    plugins_dir = ApplicationService._get_plugins_directory()
    print(f"\n插件目录路径: {plugins_dir}")
    print(f"路径是否存在: {plugins_dir.exists()}")
    print(f"是否为目录: {plugins_dir.is_dir() if plugins_dir.exists() else 'N/A'}")
    
    if plugins_dir.exists():
        print(f"\n目录内容:")
        for item in plugins_dir.iterdir():
            print(f"  - {item.name} ({'目录' if item.is_dir() else '文件'})")
            if item.is_dir():
                manifest_file = item / "manifest.json"
                print(f"    manifest.json 存在: {manifest_file.exists()}")
                if manifest_file.exists():
                    print(f"    manifest.json 路径: {manifest_file}")
    
    # 尝试扫描
    print(f"\n开始扫描插件清单...")
    plugins = ApplicationService._scan_plugin_manifests()
    print(f"扫描结果: 找到 {len(plugins)} 个插件")
    
    for plugin in plugins:
        print(f"\n插件信息:")
        print(f"  名称: {plugin.get('name', 'N/A')}")
        print(f"  代码: {plugin.get('code', 'N/A')}")
        print(f"  版本: {plugin.get('version', 'N/A')}")
        print(f"  路径: {plugin.get('_plugin_dir', 'N/A')}")


if __name__ == "__main__":
    try:
        debug_scan_path()
    except Exception as e:
        print(f"❌ 调试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


