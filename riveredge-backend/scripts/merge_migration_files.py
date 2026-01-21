"""
合并现有迁移文件

将多个迁移文件合并成一个初始迁移文件
"""

import re
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
migrations_dir = project_root / "migrations" / "models"

def extract_sql_from_migration(file_path: Path) -> str:
    """从迁移文件中提取 SQL 语句"""
    content = file_path.read_text(encoding="utf-8")
    
    # 查找 upgrade 函数中的 SQL
    match = re.search(r'async def upgrade.*?return """(.*?)"""', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

def merge_migrations():
    """合并所有迁移文件"""
    migration_files = sorted(migrations_dir.glob("*.py"), key=lambda x: int(x.name.split("_")[0]) if x.name.split("_")[0].isdigit() else 9999)
    
    all_sql = []
    all_sql.append("-- 合并后的初始迁移文件")
    all_sql.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    all_sql.append(f"-- 合并了 {len(migration_files)} 个迁移文件")
    all_sql.append("")
    all_sql.append("-- 注意: 此文件合并了所有历史迁移")
    all_sql.append("-- 使用 IF NOT EXISTS 确保表已存在时不会报错")
    all_sql.append("")
    
    for file_path in migration_files:
        if file_path.name.startswith("__") or "merged" in file_path.name:
            continue
            
        sql = extract_sql_from_migration(file_path)
        if sql:
            all_sql.append(f"-- 来自: {file_path.name}")
            all_sql.append(sql)
            all_sql.append("")
    
    merged_sql = "\n".join(all_sql)
    
    # 生成新文件
    new_file = migrations_dir / f"0_{datetime.now().strftime('%Y%m%d%H%M%S')}_merged_all_migrations.py"
    
    file_content = f'''"""
合并所有迁移文件

此文件合并了所有历史迁移文件
生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
合并文件数: {len(migration_files)}
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行所有合并的迁移
    """
    return """
{merged_sql}
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚操作（谨慎使用）
    """
    return """
-- 注意: 此操作会回滚所有变更，请谨慎使用
-- 如需回滚，请手动执行相应的 DROP 语句
"""
'''
    
    new_file.write_text(file_content, encoding="utf-8")
    print(f"✓ 合并完成: {new_file}")
    print(f"  合并了 {len(migration_files)} 个迁移文件")
    print(f"\n下一步:")
    print("1. 检查合并后的文件内容")
    print("2. 备份旧迁移文件（可选）")
    print("3. 如需清理，可删除序号 > 0 的旧迁移文件")

if __name__ == "__main__":
    merge_migrations()

