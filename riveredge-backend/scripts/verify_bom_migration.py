"""
验证BOM表迁移

检查BOM表的新字段是否已成功添加
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ 已加载 .env 文件: {env_path}")

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def verify_bom_migration():
    """
    验证BOM表迁移
    """
    try:
        print("=" * 60)
        print("验证BOM表迁移")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 检查BOM表结构
        from tortoise import connections
        conn = connections.get("default")
        
        # 查询BOM表的列信息
        result = await conn.execute_query(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'seed_master_data_bom'
            ORDER BY ordinal_position;
            """
        )
        
        columns = result[1] if result[1] else []
        
        print(f"\nBOM表字段 ({len(columns)} 个):")
        for col in columns:
            col_name, data_type, is_nullable, default = col
            nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
            default_str = f" DEFAULT {default}" if default else ""
            print(f"  - {col_name}: {data_type} {nullable}{default_str}")
        
        # 检查新添加的字段
        new_fields = [
            "version",
            "bom_code",
            "effective_date",
            "expiry_date",
            "approval_status",
            "approved_by",
            "approved_at",
            "approval_comment",
            "remark"
        ]
        
        existing_columns = [col[0] for col in columns]
        
        print(f"\n新字段验证:")
        all_present = True
        for field in new_fields:
            exists = field in existing_columns
            status = "✅ 存在" if exists else "❌ 不存在"
            print(f"  {field}: {status}")
            if not exists:
                all_present = False
        
        # 检查索引
        print(f"\n检查索引:")
        index_result = await conn.execute_query(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' 
            AND tablename = 'seed_master_data_bom'
            AND indexname LIKE 'idx_seed_master_data_bom_%'
            ORDER BY indexname;
            """
        )
        
        indexes = [row[0] for row in index_result[1]] if index_result[1] else []
        
        new_indexes = [
            "idx_seed_master_data_bom_bom_code",
            "idx_seed_master_data_bom_version",
            "idx_seed_master_data_bom_approval_status",
            "idx_seed_master_data_bom_effective_date",
            "idx_seed_master_data_bom_expiry_date"
        ]
        
        for idx in new_indexes:
            exists = idx in indexes
            status = "✅ 存在" if exists else "❌ 不存在"
            print(f"  {idx}: {status}")
        
        print("\n" + "=" * 60)
        if all_present:
            print("✅ BOM迁移验证成功！所有新字段都已添加")
        else:
            print("⚠️  BOM迁移验证失败！部分字段缺失")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(verify_bom_migration())
