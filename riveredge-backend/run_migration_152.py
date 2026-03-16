#!/usr/bin/env python
"""
手动执行迁移 152：变体属性定义增加 allow_multiple 字段

用法：cd riveredge-backend && PYTHONPATH=src python run_migration_152.py
"""
import asyncio
import os
import sys

# 确保 src 在路径中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


async def main():
    from tortoise import Tortoise
    from infra.config.infra_config import infra_settings as settings

    db_host = "127.0.0.1" if settings.DB_HOST == "localhost" else settings.DB_HOST

    await Tortoise.init(
        db_url=f"postgres://{settings.DB_USER}:{settings.DB_PASSWORD}@{db_host}:{settings.DB_PORT}/{settings.DB_NAME}",
        modules={"models": ["aerich.models"]},
    )
    conn = Tortoise.get_connection("default")

    try:
        await conn.execute_query(
            'ALTER TABLE "apps_master_data_material_variant_attribute_definitions" ADD COLUMN IF NOT EXISTS "allow_multiple" BOOLEAN NOT NULL DEFAULT FALSE'
        )
        await conn.execute_query(
            'COMMENT ON COLUMN "apps_master_data_material_variant_attribute_definitions"."allow_multiple" IS \'枚举类型是否允许多选（仅 attribute_type=enum 时有效）\''
        )
        print("✅ 迁移 152 执行成功：allow_multiple 字段已添加")
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
