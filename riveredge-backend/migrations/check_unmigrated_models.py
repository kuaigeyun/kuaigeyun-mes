"""
检查未迁移的模型

对比代码中的模型定义和迁移文件，找出未迁移的模型。

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import re
import sys
from pathlib import Path
from typing import Set, List, Dict

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

MODELS_DIR = project_root / "src" / "apps" / "kuaizhizao" / "models"
MIGRATIONS_DIR = Path(__file__).parent / "models"


def extract_table_names_from_models() -> Set[str]:
    """从模型文件中提取表名"""
    table_names = set()
    
    for model_file in MODELS_DIR.glob("*.py"):
        if model_file.name == "__init__.py":
            continue
        
        content = model_file.read_text(encoding="utf-8")
        
        # 查找 table = "..." 定义
        matches = re.findall(r'table\s*=\s*["\']([^"\']+)["\']', content)
        for match in matches:
            if match.startswith("apps_kuaizhizao_"):
                table_names.add(match)
    
    return table_names


def extract_table_names_from_migrations() -> Dict[str, List[str]]:
    """从迁移文件中提取表名"""
    created_tables = set()
    dropped_tables = set()
    
    for migration_file in MIGRATIONS_DIR.glob("*.py"):
        if migration_file.name == "__init__.py":
            continue
        
        content = migration_file.read_text(encoding="utf-8")
        
        # 分离 upgrade 和 downgrade 函数
        # 匹配格式: async def upgrade(...): return """..."""
        # 注意：需要匹配可能包含的文档字符串和注释
        upgrade_pattern = r'async\s+def\s+upgrade\s*\([^)]*\)\s*->\s*str\s*:.*?return\s+"""(.*?)"""'
        downgrade_pattern = r'async\s+def\s+downgrade\s*\([^)]*\)\s*->\s*str\s*:.*?return\s+"""(.*?)"""'
        
        upgrade_match = re.search(upgrade_pattern, content, re.DOTALL)
        downgrade_match = re.search(downgrade_pattern, content, re.DOTALL)
        
        upgrade_sql = upgrade_match.group(1) if upgrade_match else ""
        downgrade_sql = downgrade_match.group(1) if downgrade_match else ""
        
        # 只在 upgrade 函数中查找 CREATE TABLE
        create_matches = re.findall(
            r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["\']?([^"\'\s]+)["\']?',
            upgrade_sql,
            re.IGNORECASE
        )
        for match in create_matches:
            if match.startswith("apps_kuaizhizao_"):
                created_tables.add(match)
        
        # 只在 upgrade 函数中查找 DROP TABLE（用于删除表的迁移）
        # 注意：需要匹配带引号的表名
        drop_matches = re.findall(
            r'DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["\']([^"\']+)["\']',
            upgrade_sql,
            re.IGNORECASE
        )
        for match in drop_matches:
            if match.startswith("apps_kuaizhizao_"):
                dropped_tables.add(match)
    
    return {
        "created": list(created_tables),
        "dropped": list(dropped_tables)
    }


def generate_report() -> str:
    """生成未迁移模型检查报告"""
    model_tables = extract_table_names_from_models()
    migration_info = extract_table_names_from_migrations()
    created_tables = set(migration_info["created"])
    dropped_tables = set(migration_info["dropped"])
    
    # 当前存在的表 = 创建的表 - 在upgrade中删除的表
    # 注意：downgrade中的DROP TABLE是回滚操作，不应该算作删除
    current_tables = created_tables - dropped_tables
    
    # 找出未迁移的模型
    unmigrated_models = model_tables - current_tables
    
    # 找出迁移了但模型不存在的表（可能是已删除的模型）
    orphaned_tables = current_tables - model_tables
    
    report = []
    report.append("=" * 80)
    report.append("未迁移模型检查报告")
    report.append("=" * 80)
    report.append("")
    
    # 1. 模型文件中的表
    report.append("📋 模型文件中的表（共 {} 个）".format(len(model_tables)))
    report.append("-" * 80)
    for table in sorted(model_tables):
        status = "✅ 已迁移" if table in current_tables else "❌ 未迁移"
        if table in dropped_tables:
            status = "🗑️  已删除"
        report.append(f"  {status} {table}")
    report.append("")
    
    # 2. 迁移文件中的表
    report.append("📋 迁移文件中的表")
    report.append("-" * 80)
    report.append(f"  创建的表: {len(created_tables)} 个")
    report.append(f"  删除的表: {len(dropped_tables)} 个")
    report.append(f"  当前存在的表: {len(current_tables)} 个")
    report.append("")
    
    # 3. 未迁移的模型
    if unmigrated_models:
        report.append("⚠️  未迁移的模型（共 {} 个）".format(len(unmigrated_models)))
        report.append("-" * 80)
        for table in sorted(unmigrated_models):
            report.append(f"  ❌ {table}")
        report.append("")
        report.append("建议操作：")
        report.append("  1. 检查这些模型是否还需要")
        report.append("  2. 如果需要，创建对应的迁移文件")
        report.append("  3. 如果不需要，删除模型文件")
    else:
        report.append("✅ 所有模型都已迁移")
        report.append("")
    
    # 4. 孤立的表（迁移了但模型不存在）
    if orphaned_tables:
        report.append("⚠️  孤立的表（迁移了但模型不存在，共 {} 个）".format(len(orphaned_tables)))
        report.append("-" * 80)
        for table in sorted(orphaned_tables):
            report.append(f"  ⚠️  {table}")
        report.append("")
        report.append("建议操作：")
        report.append("  1. 检查这些表是否还需要")
        report.append("  2. 如果不需要，创建迁移文件删除这些表")
        report.append("  3. 如果需要，创建对应的模型文件")
    else:
        report.append("✅ 没有孤立的表")
        report.append("")
    
    # 5. 总结
    report.append("📊 总结")
    report.append("-" * 80)
    total_issues = len(unmigrated_models) + len(orphaned_tables)
    if total_issues == 0:
        report.append("✅ 所有模型都已正确迁移，没有发现问题")
    else:
        report.append(f"⚠️  发现 {total_issues} 个问题需要处理")
        if unmigrated_models:
            report.append(f"  - {len(unmigrated_models)} 个未迁移的模型")
        if orphaned_tables:
            report.append(f"  - {len(orphaned_tables)} 个孤立的表")
    
    report.append("")
    report.append("=" * 80)
    
    return "\n".join(report)


if __name__ == "__main__":
    try:
        report = generate_report()
        print(report)
        
        # 保存报告到文件
        report_file = MIGRATIONS_DIR.parent / "unmigrated_models_report.txt"
        report_file.write_text(report, encoding="utf-8")
        print(f"\n报告已保存到: {report_file}")
        
    except Exception as e:
        print(f"❌ 检查过程中出现错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

