"""
从 public.sql 生成 Aerich 迁移文件

此脚本解析 public.sql 文件，生成符合 Aerich 格式的迁移文件。
生成的迁移文件可以用于在新环境中创建完整的数据库结构。

使用方法:
    # 使用默认路径（自动查找 public.sql）
    python migrations/generate_migration_from_sql.py
    
    # 指定 SQL 文件路径
    python migrations/generate_migration_from_sql.py <path_to_public.sql>
    
    # 指定输出文件名
    python migrations/generate_migration_from_sql.py <path_to_public.sql> --output <output_file.py>
"""

import re
from pathlib import Path
from datetime import datetime
from typing import List, Tuple


def parse_sql_file(sql_file_path: Path) -> Tuple[List[str], List[str], List[str], List[str]]:
    """
    解析 SQL 文件，提取 CREATE TABLE, CREATE SEQUENCE, CREATE INDEX, COMMENT 语句
    
    Returns:
        Tuple[List[str], List[str], List[str], List[str]]: 
        (tables, sequences, indexes, comments)
    """
    content = sql_file_path.read_text(encoding='utf-8')
    
    # 移除 DROP 语句（迁移文件应该只包含 CREATE）
    content = re.sub(r'DROP\s+(?:TABLE|SEQUENCE|INDEX)\s+IF\s+EXISTS[^;]+;', '', content, flags=re.IGNORECASE)
    
    tables = []
    sequences = []
    indexes = []
    comments = []
    
    # 按行分割，便于处理多行语句
    lines = content.split('\n')
    current_statement = []
    in_table = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('--') or stripped.startswith('/*'):
            continue
        
        current_statement.append(line)
        full_statement = ' '.join(current_statement)
        
        # 检测语句结束
        if ';' in stripped:
            statement = ' '.join(current_statement).strip()
            
            # 分类语句
            if re.match(r'CREATE\s+SEQUENCE', statement, re.IGNORECASE):
                # 确保使用 IF NOT EXISTS
                if 'IF NOT EXISTS' not in statement.upper():
                    statement = statement.replace('CREATE SEQUENCE', 'CREATE SEQUENCE IF NOT EXISTS', 1)
                sequences.append(statement)
            elif re.match(r'CREATE\s+TABLE', statement, re.IGNORECASE):
                # 确保使用 IF NOT EXISTS
                if 'IF NOT EXISTS' not in statement.upper():
                    statement = statement.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS', 1)
                tables.append(statement)
            elif re.match(r'CREATE\s+(?:UNIQUE\s+)?INDEX', statement, re.IGNORECASE):
                # 确保使用 IF NOT EXISTS
                if 'IF NOT EXISTS' not in statement.upper():
                    statement = statement.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS', 1)
                    statement = statement.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS', 1)
                indexes.append(statement)
            elif re.match(r'COMMENT\s+ON', statement, re.IGNORECASE):
                comments.append(statement)
            
            current_statement = []
            in_table = False
    
    return tables, sequences, indexes, comments


def generate_migration_file(
    output_path: Path,
    tables: List[str],
    sequences: List[str],
    indexes: List[str],
    comments: List[str]
) -> None:
    """生成 Aerich 迁移文件"""
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    
    # 生成 SQL 内容
    sql_parts = []
    
    # 1. 创建序列
    if sequences:
        sql_parts.append("        -- 创建序列")
        for seq in sequences:
            # 确保使用 IF NOT EXISTS
            seq_sql = seq.replace('CREATE SEQUENCE', 'CREATE SEQUENCE IF NOT EXISTS')
            sql_parts.append(f"        {seq_sql}")
        sql_parts.append("")
    
    # 2. 创建表
    if tables:
        sql_parts.append("        -- 创建表")
        for table in tables:
            # 确保使用 IF NOT EXISTS
            table_sql = table.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')
            sql_parts.append(f"        {table_sql}")
            sql_parts.append("")
        sql_parts.append("")
    
    # 3. 创建索引
    if indexes:
        sql_parts.append("        -- 创建索引")
        for idx in indexes:
            # 确保使用 IF NOT EXISTS
            if 'IF NOT EXISTS' not in idx.upper():
                idx_sql = idx.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS')
                idx_sql = idx_sql.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS')
            else:
                idx_sql = idx
            sql_parts.append(f"        {idx_sql}")
        sql_parts.append("")
    
    # 4. 添加注释
    if comments:
        sql_parts.append("        -- 添加表注释和字段注释")
        for comment in comments:
            sql_parts.append(f"        {comment}")
        sql_parts.append("")
    
    sql_content = "\n".join(sql_parts)
    
    # 生成迁移文件内容
    migration_content = f'''"""
初始数据库结构迁移 - 从 public.sql 生成

此迁移文件包含完整的数据库结构定义，包括：
- {len(sequences)} 个序列
- {len(tables)} 个表
- {len(indexes)} 个索引
- {len(comments)} 个注释

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
来源: public.sql
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建完整的数据库结构
    
    此迁移基于 public.sql 文件生成，包含所有表、序列、索引和注释。
    """
    return """
{sql_content}
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除所有数据库结构
    
    警告：此操作会删除所有表和数据，请谨慎使用！
    """
    return """
    -- 降级操作：删除所有表
    -- 注意：此操作会删除所有数据，请谨慎使用！
    
    -- 由于表之间存在外键依赖，需要按顺序删除
    -- 这里只提供示例，实际使用时需要根据依赖关系调整顺序
    
    -- DROP TABLE IF EXISTS "table_name" CASCADE;
    """
'''
    
    # 写入文件
    output_path.write_text(migration_content, encoding='utf-8')
    print(f"✅ 已生成迁移文件: {output_path}")
    print(f"   - 序列: {len(sequences)} 个")
    print(f"   - 表: {len(tables)} 个")
    print(f"   - 索引: {len(indexes)} 个")
    print(f"   - 注释: {len(comments)} 个")


def main():
    """主函数"""
    import sys
    import argparse
    
    project_root = Path(__file__).parent.parent
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='从 public.sql 生成 Aerich 迁移文件',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 自动查找 public.sql
  python migrations/generate_migration_from_sql.py
  
  # 指定 SQL 文件路径
  python migrations/generate_migration_from_sql.py path/to/public.sql
  
  # 指定输出文件名
  python migrations/generate_migration_from_sql.py public.sql -o 0_init_schema.py
        """
    )
    parser.add_argument(
        'sql_file',
        nargs='?',
        help='SQL 文件路径（可选，默认自动查找 public.sql）'
    )
    parser.add_argument(
        '-o', '--output',
        help='输出迁移文件路径（可选，默认自动生成）'
    )
    
    args = parser.parse_args()
    
    # 确定 SQL 文件路径
    if args.sql_file:
        sql_file = Path(args.sql_file)
        if not sql_file.is_absolute():
            sql_file = project_root / sql_file
    else:
        # 默认查找 public.sql
        possible_paths = [
            project_root / 'migrations' / 'models' / 'public.sql',
            project_root / 'public.sql',
            Path.cwd() / 'public.sql',
        ]
        sql_file = None
        for path in possible_paths:
            if path.exists():
                sql_file = path
                break
    
    if not sql_file or not sql_file.exists():
        print(f"❌ 错误: public.sql 文件不存在")
        print("   请先导出数据库结构到 public.sql，或使用以下命令指定路径:")
        print("   python migrations/generate_migration_from_sql.py <path_to_public.sql>")
        print()
        print("   尝试查找的位置:")
        for path in possible_paths:
            status = "✅ 找到" if path.exists() else "❌ 不存在"
            print(f"     {status}: {path}")
        return
    
    # 确定输出文件路径
    if args.output:
        output_file = Path(args.output)
        if not output_file.is_absolute():
            output_file = project_root / 'migrations' / 'models' / output_file
    else:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        output_file = project_root / 'migrations' / 'models' / f'0_{timestamp}_init_from_public_sql.py'
    
    print("=" * 60)
    print("从 public.sql 生成 Aerich 迁移文件")
    print("=" * 60)
    print()
    
    print("1. 解析 public.sql 文件...")
    try:
        tables, sequences, indexes, comments = parse_sql_file(sql_file)
        print(f"   ✅ 解析完成:")
        print(f"      - 序列: {len(sequences)} 个")
        print(f"      - 表: {len(tables)} 个")
        print(f"      - 索引: {len(indexes)} 个")
        print(f"      - 注释: {len(comments)} 个")
    except Exception as e:
        print(f"   ❌ 解析失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print()
    print("2. 生成迁移文件...")
    print(f"   输入文件: {sql_file}")
    print(f"   输出文件: {output_file}")
    
    try:
        generate_migration_file(output_file, tables, sequences, indexes, comments)
        print()
        print("=" * 60)
        print("✅ 迁移文件生成成功！")
        print("=" * 60)
        print()
        print("📋 生成统计:")
        print(f"   - 序列: {len(sequences)} 个")
        print(f"   - 表: {len(tables)} 个")
        print(f"   - 索引: {len(indexes)} 个")
        print(f"   - 注释: {len(comments)} 个")
        print()
        print("📝 下一步操作:")
        print("  1. 检查生成的迁移文件是否正确")
        print(f"     cat {output_file.relative_to(project_root)}")
        print()
        print("  2. 应用迁移（选择一种方式）:")
        print("     a) 使用 Aerich（如果可用）:")
        print("        uv run aerich upgrade")
        print()
        print("     b) 使用手动脚本:")
        print("        python migrations/apply_migration_manually.py")
        print()
        print("     c) 直接执行 SQL（不推荐，但可以作为备选）:")
        print("        psql -U your_user -d your_db -f migrations/models/public.sql")
        print()
    except Exception as e:
        print(f"   ❌ 生成失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

