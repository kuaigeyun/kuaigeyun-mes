"""
执行 Favicon 字段迁移

直接执行 SQL 添加 favicon 字段到平台设置表。
当 aerich upgrade 因格式问题失败时，可使用此脚本。

用法: python migrations/run_favicon_migration.py
"""

import asyncio
import asyncpg
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
except ImportError:
    pass


async def run_migration():
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', 5432))
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'riveredge')

    conn = await asyncpg.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name,
    )

    try:
        # 检查 favicon 列是否已存在
        exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'infra_platform_settings' AND column_name = 'favicon'
            )
        """)

        if exists:
            print("✅ favicon 字段已存在，无需迁移")
            return

        print("🔄 正在添加 favicon 字段...")
        await conn.execute("""
            ALTER TABLE "infra_platform_settings"
            ADD COLUMN IF NOT EXISTS "favicon" VARCHAR(500) NULL;

            COMMENT ON COLUMN "infra_platform_settings"."favicon" IS '网站 Favicon URL（浏览器标签页图标）';
        """)
        print("✅ favicon 字段添加成功！")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
