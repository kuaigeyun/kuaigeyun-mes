"""
标记初始迁移已应用

在 aerich 表中记录初始迁移已经应用，避免重复应用
"""

import asyncio
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from soil.infrastructure.database.database import TORTOISE_ORM


async def mark_init_applied():
    """
    标记初始迁移已应用
    """
    try:
        print("=" * 60)
        print("标记初始迁移已应用")
        print("=" * 60)
        
        # 初始化 Tortoise ORM
        await Tortoise.init(config=TORTOISE_ORM)
        
        from tortoise import connections
        conn = connections.get("default")
        
        # 检查是否已存在记录
        result = await conn.execute_query(
            """
            SELECT id FROM aerich 
            WHERE app = 'models' AND version = '0_20251201_init_clean_schema.py';
            """
        )
        
        if result[1] and len(result[1]) > 0:
            print("\n✅ 初始迁移记录已存在，无需重复标记")
        else:
            # 读取初始迁移文件内容（用于 content 字段）
            migrate_file = Path(__file__).parent.parent / "migrations" / "models" / "0_20251201_init_clean_schema.py"
            if migrate_file.exists():
                content = migrate_file.read_text(encoding='utf-8')
                # 截取前 1000 字符作为 content（aerich 表可能有限制）
                content_preview = content[:1000] if len(content) > 1000 else content
                # 转换为 JSON 字符串
                content_json = json.dumps(content_preview, ensure_ascii=False)
            else:
                content_json = json.dumps("")
            
            # 插入记录（使用 PostgreSQL 占位符 $1，content 是 JSONB 类型）
            await conn.execute_query(
                """
                INSERT INTO aerich (version, app, content)
                VALUES ('0_20251201_init_clean_schema.py', 'models', $1::jsonb)
                ON CONFLICT DO NOTHING;
                """,
                [content_json]
            )
            print("\n✅ 已标记初始迁移为已应用")
        
        # 验证
        result = await conn.execute_query(
            """
            SELECT version, app FROM aerich WHERE app = 'models' ORDER BY id;
            """
        )
        
        print(f"\n当前迁移记录 ({len(result[1]) if result[1] else 0} 个):")
        if result[1]:
            for row in result[1]:
                print(f"  - {row[0]} (app: {row[1]})")
        
        print("\n" + "=" * 60)
        print("✅ 完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(mark_init_applied())

