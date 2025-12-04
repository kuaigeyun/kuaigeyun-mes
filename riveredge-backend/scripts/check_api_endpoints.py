#!/usr/bin/env python3
"""
检查并规范 API 端点命名
确保所有端点遵循 RESTful 规范和新的命名规范
"""

import re
from pathlib import Path
from typing import List, Dict, Tuple

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.parent
BACKEND_SRC = PROJECT_ROOT / "riveredge-backend" / "src"

# API 端点命名规范
ENDPOINT_RULES = {
    "prefix": {
        "platform": ["/tenants", "/packages", "/admin", "/auth", "/monitoring", "/saved-searches"],
        "core": ["/users", "/roles", "/permissions", "/departments", "/positions", 
                "/data-dictionaries", "/system-parameters", "/code-rules", "/custom-fields",
                "/site-settings", "/invitation-codes", "/languages", "/applications", "/menus",
                "/integration-configs", "/files", "/apis", "/data-sources", "/datasets",
                "/message-configs", "/message-templates", "/messages", "/scheduled-tasks",
                "/approval-processes", "/approval-instances", "/electronic-records", "/scripts",
                "/print-templates", "/print-devices", "/operation-logs", "/login-logs",
                "/online-users", "/data-backups", "/help-documents"],
        "personal": ["/user-profile", "/user-preferences", "/user-messages", "/user-tasks"]
    },
    "patterns": {
        "kebab-case": r"^[a-z]+(-[a-z]+)*$",  # kebab-case 格式
        "plural": True,  # 应该使用复数形式
    }
}


def check_endpoint_naming(file_path: Path) -> List[Dict]:
    """检查单个文件的端点命名"""
    issues = []
    
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # 查找 APIRouter 定义
        router_match = re.search(r'router\s*=\s*APIRouter\([^)]*\)', content, re.MULTILINE)
        if router_match:
            router_def = router_match.group(0)
            
            # 提取 prefix
            prefix_match = re.search(r'prefix=["\']([^"\']+)["\']', router_def)
            if prefix_match:
                prefix = prefix_match.group(1)
                
                # 检查 prefix 格式
                if not re.match(ENDPOINT_RULES["patterns"]["kebab-case"], prefix.lstrip('/')):
                    issues.append({
                        "file": str(file_path.relative_to(BACKEND_SRC)),
                        "type": "prefix_format",
                        "issue": f"前缀 '{prefix}' 不符合 kebab-case 规范",
                        "prefix": prefix
                    })
                
                # 检查是否使用复数形式（简单检查）
                if prefix and not prefix.endswith('s') and prefix not in ['/auth', '/admin', '/monitoring']:
                    # 某些单词本身就是复数或特殊形式，需要排除
                    singular_words = ['user', 'role', 'permission', 'department', 'position', 
                                   'menu', 'file', 'api', 'message', 'script', 'help']
                    if any(prefix.endswith(f'/{word}') for word in singular_words):
                        issues.append({
                            "file": str(file_path.relative_to(BACKEND_SRC)),
                            "type": "prefix_plural",
                            "issue": f"前缀 '{prefix}' 应该使用复数形式",
                            "prefix": prefix
                        })
        
        # 查找路由装饰器
        route_patterns = [
            r'@router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
            r'@router\.(get|post|put|delete|patch)\(([^,)]+)',
        ]
        
        for pattern in route_patterns:
            for match in re.finditer(pattern, content):
                route_path = match.group(2).strip('"\'')
                # 清理路径（移除变量部分）
                route_path = re.sub(r'\{[^}]+\}', '', route_path)
                
                if route_path and route_path != '/':
                    # 检查路径格式
                    path_parts = [p for p in route_path.split('/') if p]
                    for part in path_parts:
                        if part and not re.match(ENDPOINT_RULES["patterns"]["kebab-case"], part):
                            issues.append({
                                "file": str(file_path.relative_to(BACKEND_SRC)),
                                "type": "route_path_format",
                                "issue": f"路径部分 '{part}' 不符合 kebab-case 规范",
                                "path": route_path
                            })
    
    except Exception as e:
        issues.append({
            "file": str(file_path.relative_to(BACKEND_SRC)),
            "type": "error",
            "issue": f"读取文件时出错: {e}",
        })
    
    return issues


def scan_all_api_files() -> Tuple[List[Dict], Dict[str, List[str]]]:
    """扫描所有 API 文件"""
    all_issues = []
    endpoint_map = {
        "platform": [],
        "core": [],
        "personal": [],
        "other": []
    }
    
    # 扫描 platform API
    platform_api_dir = BACKEND_SRC / "platform" / "api"
    if platform_api_dir.exists():
        for api_file in platform_api_dir.rglob("*.py"):
            if api_file.name != "__init__.py" and not api_file.name.startswith("_"):
                issues = check_endpoint_naming(api_file)
                all_issues.extend(issues)
                
                # 提取端点信息
                try:
                    content = api_file.read_text(encoding='utf-8')
                    prefix_match = re.search(r'prefix=["\']([^"\']+)["\']', content)
                    if prefix_match:
                        endpoint_map["platform"].append(prefix_match.group(1))
                except:
                    pass
    
    # 扫描 core API
    core_api_dir = BACKEND_SRC / "core" / "api"
    if core_api_dir.exists():
        for api_file in core_api_dir.rglob("*.py"):
            if api_file.name != "__init__.py" and not api_file.name.startswith("_"):
                issues = check_endpoint_naming(api_file)
                all_issues.extend(issues)
                
                # 提取端点信息
                try:
                    content = api_file.read_text(encoding='utf-8')
                    prefix_match = re.search(r'prefix=["\']([^"\']+)["\']', content)
                    if prefix_match:
                        prefix = prefix_match.group(1)
                        if prefix.startswith("/user-"):
                            endpoint_map["personal"].append(prefix)
                        else:
                            endpoint_map["core"].append(prefix)
                except:
                    pass
    
    return all_issues, endpoint_map


def main():
    """主函数"""
    print("=" * 60)
    print("🔍 检查 API 端点命名规范")
    print("=" * 60)
    
    issues, endpoint_map = scan_all_api_files()
    
    # 显示端点映射
    print("\n📋 API 端点分类:")
    print(f"\n平台级端点 ({len(endpoint_map['platform'])}):")
    for ep in sorted(set(endpoint_map['platform'])):
        print(f"  - {ep}")
    
    print(f"\n系统级端点 ({len(endpoint_map['core'])}):")
    for ep in sorted(set(endpoint_map['core'])):
        print(f"  - {ep}")
    
    print(f"\n个人功能端点 ({len(endpoint_map['personal'])}):")
    for ep in sorted(set(endpoint_map['personal'])):
        print(f"  - {ep}")
    
    # 显示问题
    if issues:
        print(f"\n⚠️  发现 {len(issues)} 个问题:")
        for issue in issues:
            print(f"\n  📁 {issue['file']}")
            print(f"     ❌ {issue['issue']}")
    else:
        print("\n✅ 所有 API 端点命名符合规范！")
    
    print("\n" + "=" * 60)
    
    return issues, endpoint_map


if __name__ == '__main__':
    main()

