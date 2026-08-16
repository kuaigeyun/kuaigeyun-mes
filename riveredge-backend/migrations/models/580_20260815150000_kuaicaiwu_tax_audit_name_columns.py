"""
补全税务表审计人名字段（与 BaseModel 对齐）

Author: Auto
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_gl_tax_settings"
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);

        ALTER TABLE "apps_kuaicaiwu_tax_period_records"
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_tax_period_records"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "created_by_name";

        ALTER TABLE "apps_kuaicaiwu_gl_tax_settings"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "created_by_name";
    """
