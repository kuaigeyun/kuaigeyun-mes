"""
检查迁移链条完整性

分析现有迁移文件，检查是否有缺失或重复的迁移。
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

def extract_migration_info(file_path: Path) -> Dict[str, any]:
    """提取迁移文件信息"""
    content = file_path.read_text(encoding='utf-8')
    
    # 提取迁移类名
    class_match = re.search(r'class\s+(\w+)\s*\(.*Migration\)', content)
    class_name = class_match.group(1) if class_match else None
    
    # 提取版本号（文件名中的数字前缀）
    version_match = re.match(r'(\d+)_', file_path.name)
    version = int(version_match.group(1)) if version_match else None
    
    # 提取日期时间（文件名中的日期部分）
    date_match = re.search(r'(\d{8})', file_path.name)
    date_str = date_match.group(1) if date_match else None
    
    # 检查是否有 upgrade 函数
    has_upgrade = 'async def upgrade' in content or 'def upgrade' in content
    
    # 检查是否有 downgrade 函数
    has_downgrade = 'async def downgrade' in content or 'def downgrade' in content
    
    return {
        'file': file_path.name,
        'version': version,
        'date': date_str,
        'class_name': class_name,
        'has_upgrade': has_upgrade,
        'has_downgrade': has_downgrade,
        'size': file_path.stat().st_size,
    }

def check_migration_chain(migrations_dir: Path) -> Dict[str, any]:
    """检查迁移链条"""
    migration_files = sorted(migrations_dir.glob('[0-9]*_*.py'))
    
    migrations = []
    for file_path in migration_files:
        if file_path.name == '__init__.py':
            continue
        info = extract_migration_info(file_path)
        migrations.append(info)
    
    # 按版本号排序
    migrations.sort(key=lambda x: x['version'] if x['version'] is not None else 999999)
    
    # 检查版本号连续性
    gaps = []
    versions = [m['version'] for m in migrations if m['version'] is not None]
    if versions:
        min_version = min(versions)
        max_version = max(versions)
        expected_versions = set(range(min_version, max_version + 1))
        actual_versions = set(versions)
        missing_versions = sorted(expected_versions - actual_versions)
        if missing_versions:
            gaps = missing_versions
    
    # 检查重复版本号
    duplicates = []
    version_counts = {}
    for m in migrations:
        if m['version'] is not None:
            version_counts[m['version']] = version_counts.get(m['version'], 0) + 1
    duplicates = [v for v, count in version_counts.items() if count > 1]
    
    # 检查是否有 upgrade/downgrade 函数
    incomplete = [m for m in migrations if not m['has_upgrade']]
    
    return {
        'total': len(migrations),
        'migrations': migrations,
        'gaps': gaps,
        'duplicates': duplicates,
        'incomplete': incomplete,
        'version_range': (min(versions) if versions else None, max(versions) if versions else None),
    }

def analyze_sql_tables(sql_file: Path) -> List[str]:
    """分析 SQL 文件中的表名"""
    if not sql_file.exists():
        return []
    
    content = sql_file.read_text(encoding='utf-8')
    # 提取 CREATE TABLE 语句中的表名
    table_pattern = r'CREATE TABLE\s+"public"\."([^"]+)"'
    tables = re.findall(table_pattern, content, re.IGNORECASE)
    return sorted(set(tables))

def main():
    """主函数"""
    project_root = Path(__file__).parent.parent
    migrations_dir = project_root / 'migrations' / 'models'
    sql_file = migrations_dir / 'public.sql'
    
    print("=" * 60)
    print("迁移链条完整性检查")
    print("=" * 60)
    print()
    
    # 检查迁移文件
    print("1. 检查迁移文件...")
    result = check_migration_chain(migrations_dir)
    
    print(f"   总迁移文件数: {result['total']}")
    if result['version_range'][0] is not None:
        print(f"   版本范围: {result['version_range'][0]} - {result['version_range'][1]}")
    print()
    
    # 检查缺失版本
    if result['gaps']:
        print(f"   ⚠️  发现缺失版本: {result['gaps']}")
    else:
        print("   ✅ 版本号连续")
    print()
    
    # 检查重复版本
    if result['duplicates']:
        print(f"   ⚠️  发现重复版本: {result['duplicates']}")
        for dup_version in result['duplicates']:
            dup_files = [m['file'] for m in result['migrations'] if m['version'] == dup_version]
            print(f"      版本 {dup_version}: {', '.join(dup_files)}")
    else:
        print("   ✅ 无重复版本")
    print()
    
    # 检查不完整的迁移
    if result['incomplete']:
        print(f"   ⚠️  发现不完整迁移（缺少 upgrade 函数）: {len(result['incomplete'])} 个")
        for m in result['incomplete']:
            print(f"      - {m['file']}")
    else:
        print("   ✅ 所有迁移文件都包含 upgrade 函数")
    print()
    
    # 分析 SQL 文件中的表
    print("2. 分析 public.sql 中的表结构...")
    tables = analyze_sql_tables(sql_file)
    print(f"   发现表数量: {len(tables)}")
    if tables:
        print(f"   前10个表: {', '.join(tables[:10])}")
        if len(tables) > 10:
            print(f"   ... 还有 {len(tables) - 10} 个表")
    print()
    
    # 生成报告
    print("3. 迁移文件列表（按版本号排序）:")
    for m in result['migrations'][:20]:  # 只显示前20个
        status = "✅" if m['has_upgrade'] else "⚠️"
        print(f"   {status} {m['file']:50s} (版本: {m['version']}, 类: {m['class_name']})")
    if len(result['migrations']) > 20:
        print(f"   ... 还有 {len(result['migrations']) - 20} 个迁移文件")
    print()
    
    # 总结
    print("=" * 60)
    print("检查总结")
    print("=" * 60)
    issues = []
    if result['gaps']:
        issues.append(f"缺失版本: {len(result['gaps'])} 个")
    if result['duplicates']:
        issues.append(f"重复版本: {len(result['duplicates'])} 个")
    if result['incomplete']:
        issues.append(f"不完整迁移: {len(result['incomplete'])} 个")
    
    if issues:
        print("⚠️  发现问题:")
        for issue in issues:
            print(f"   - {issue}")
        print()
        print("建议:")
        print("   1. 运行 init_from_current_db.sh 重新初始化迁移")
        print("   2. 或手动修复缺失/重复的迁移文件")
    else:
        print("✅ 迁移链条完整，未发现问题")
    print()

if __name__ == '__main__':
    main()

