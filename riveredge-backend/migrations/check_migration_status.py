"""
数据库迁移状态检测脚本

检查当前项目的迁移文件状态，包括：
1. 迁移文件列表和顺序
2. 迁移文件格式检查
3. 版本号连续性检查
4. 迁移文件命名规范检查

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

MIGRATIONS_DIR = Path(__file__).parent / "models"


def get_migration_files() -> List[Path]:
    """获取所有迁移文件"""
    files = []
    for file in MIGRATIONS_DIR.glob("*.py"):
        if file.name != "__init__.py":
            files.append(file)
    return sorted(files)


def parse_migration_name(filename: str) -> Tuple[int, str, str]:
    """
    解析迁移文件名
    
    格式: {version}_{timestamp}_{name}.py
    例如: 0_init_schema.py 或 1_20251230192227_create_kuaizhizao_tables.py
    
    Returns:
        (version, timestamp, name)
    """
    # 移除 .py 扩展名
    name = filename.replace(".py", "")
    
    # 匹配格式: version_timestamp_name 或 version_name
    match = re.match(r"^(\d+)(?:_(\d+))?_(.+)$", name)
    if match:
        version = int(match.group(1))
        timestamp = match.group(2) or ""
        name_part = match.group(3)
        return (version, timestamp, name_part)
    
    # 如果格式不匹配，尝试只提取版本号
    match = re.match(r"^(\d+)", name)
    if match:
        version = int(match.group(1))
        return (version, "", name)
    
    return (999, "", name)


def check_migration_format(file_path: Path) -> Dict[str, any]:
    """检查迁移文件格式"""
    issues = []
    content = file_path.read_text(encoding="utf-8")
    
    # 检查必要的导入
    if "from tortoise import BaseDBAsyncClient" not in content:
        issues.append("缺少必要的导入: from tortoise import BaseDBAsyncClient")
    
    # 检查 upgrade 函数
    if "async def upgrade" not in content:
        issues.append("缺少 upgrade 函数")
    elif "async def upgrade(db: BaseDBAsyncClient) -> str:" not in content:
        issues.append("upgrade 函数签名不正确")
    
    # 检查 RUN_IN_TRANSACTION
    if "RUN_IN_TRANSACTION" not in content:
        issues.append("缺少 RUN_IN_TRANSACTION 变量")
    
    # 检查是否有 SQL 语句
    if "return \"\"\"" in content or 'return """' in content:
        # 检查 SQL 是否为空
        sql_match = re.search(r'return\s+"""(.*?)"""', content, re.DOTALL)
        if sql_match and not sql_match.group(1).strip():
            issues.append("upgrade 函数返回的 SQL 为空")
    
    return {
        "file": file_path.name,
        "valid": len(issues) == 0,
        "issues": issues
    }


def check_version_continuity(migration_files: List[Path]) -> Dict[str, any]:
    """检查版本号连续性"""
    versions = []
    duplicates = []
    
    for file in migration_files:
        version, _, _ = parse_migration_name(file.name)
        if version in versions:
            duplicates.append((version, file.name))
        versions.append(version)
    
    # 检查连续性
    missing = []
    if versions:
        min_version = min(versions)
        max_version = max(versions)
        expected = set(range(min_version, max_version + 1))
        actual = set(versions)
        missing = sorted(expected - actual)
    
    return {
        "versions": sorted(set(versions)),
        "duplicates": duplicates,
        "missing": missing,
        "continuous": len(missing) == 0 and len(duplicates) == 0
    }


def generate_report() -> str:
    """生成迁移状态报告"""
    migration_files = get_migration_files()
    
    report = []
    report.append("=" * 80)
    report.append("数据库迁移状态检测报告")
    report.append("=" * 80)
    report.append(f"检测时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"迁移文件目录: {MIGRATIONS_DIR}")
    report.append("")
    
    # 1. 迁移文件列表
    report.append("📋 迁移文件列表")
    report.append("-" * 80)
    if not migration_files:
        report.append("❌ 未找到迁移文件")
    else:
        report.append(f"✅ 找到 {len(migration_files)} 个迁移文件:")
        report.append("")
        for i, file in enumerate(migration_files, 1):
            version, timestamp, name = parse_migration_name(file.name)
            size = file.stat().st_size
            report.append(f"  {i:2d}. [{version:2d}] {file.name}")
            report.append(f"      版本: {version}, 时间戳: {timestamp or 'N/A'}, 名称: {name}")
            report.append(f"      大小: {size:,} 字节")
            report.append("")
    
    # 2. 版本号连续性检查
    report.append("🔢 版本号连续性检查")
    report.append("-" * 80)
    continuity = check_version_continuity(migration_files)
    if continuity["continuous"]:
        report.append("✅ 版本号连续，无重复")
    else:
        if continuity["duplicates"]:
            report.append("⚠️  发现重复的版本号:")
            for version, filename in continuity["duplicates"]:
                report.append(f"   版本 {version}: {filename}")
        if continuity["missing"]:
            report.append("⚠️  发现缺失的版本号:")
            report.append(f"   {continuity['missing']}")
    report.append("")
    
    # 3. 迁移文件格式检查
    report.append("📝 迁移文件格式检查")
    report.append("-" * 80)
    format_issues = []
    for file in migration_files:
        result = check_migration_format(file)
        if not result["valid"]:
            format_issues.append(result)
    
    if not format_issues:
        report.append("✅ 所有迁移文件格式正确")
    else:
        report.append(f"⚠️  发现 {len(format_issues)} 个格式问题:")
        for issue in format_issues:
            report.append(f"   {issue['file']}:")
            for problem in issue["issues"]:
                report.append(f"     - {problem}")
    report.append("")
    
    # 4. 迁移文件命名规范检查
    report.append("📛 迁移文件命名规范检查")
    report.append("-" * 80)
    naming_issues = []
    for file in migration_files:
        version, timestamp, name = parse_migration_name(file.name)
        issues = []
        
        # 检查命名格式
        if not re.match(r"^\d+(_\d+)?_.+\.py$", file.name):
            issues.append(f"命名格式不符合规范: {file.name}")
        
        # 检查版本号
        if version < 0:
            issues.append(f"版本号无效: {version}")
        
        # 检查时间戳格式（如果存在）
        if timestamp and not re.match(r"^\d{14}$", timestamp):
            issues.append(f"时间戳格式不正确: {timestamp}")
        
        if issues:
            naming_issues.append({"file": file.name, "issues": issues})
    
    if not naming_issues:
        report.append("✅ 所有迁移文件命名符合规范")
    else:
        report.append(f"⚠️  发现 {len(naming_issues)} 个命名问题:")
        for issue in naming_issues:
            report.append(f"   {issue['file']}:")
            for problem in issue["issues"]:
                report.append(f"     - {problem}")
    report.append("")
    
    # 5. 总结
    report.append("📊 总结")
    report.append("-" * 80)
    total_issues = len(format_issues) + len(naming_issues)
    if continuity["duplicates"]:
        total_issues += len(continuity["duplicates"])
    if continuity["missing"]:
        total_issues += len(continuity["missing"])
    
    if total_issues == 0:
        report.append("✅ 迁移文件状态良好，未发现问题")
    else:
        report.append(f"⚠️  发现 {total_issues} 个问题需要处理")
        report.append("")
        report.append("建议操作:")
        if continuity["duplicates"]:
            report.append("  1. 修复重复的版本号（重命名文件或合并迁移）")
        if continuity["missing"]:
            report.append("  2. 检查缺失的版本号是否必要")
        if format_issues:
            report.append("  3. 修复迁移文件格式问题")
        if naming_issues:
            report.append("  4. 修复迁移文件命名问题")
    
    report.append("")
    report.append("=" * 80)
    
    return "\n".join(report)


if __name__ == "__main__":
    try:
        report = generate_report()
        print(report)
        
        # 保存报告到文件
        report_file = MIGRATIONS_DIR.parent / "migration_status_report.txt"
        report_file.write_text(report, encoding="utf-8")
        print(f"\n报告已保存到: {report_file}")
        
    except Exception as e:
        print(f"❌ 检测过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

