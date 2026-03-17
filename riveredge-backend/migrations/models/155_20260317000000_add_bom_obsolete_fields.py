"""
BOM 表增加失效相关字段

- is_obsolete: 是否已失效（人为设置，与 expiry_date 日期失效区分）
- obsoleted_at: 失效时间
- obsolete_reason: 失效原因

Author: AI Assistant
Date: 2026-03-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_obsolete" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "obsoleted_at" TIMESTAMPTZ NULL;
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "obsolete_reason" VARCHAR(500) NULL;
        COMMENT ON COLUMN "apps_master_data_bom"."is_obsolete" IS '是否已失效（人为设置）';
        COMMENT ON COLUMN "apps_master_data_bom"."obsoleted_at" IS '失效时间';
        COMMENT ON COLUMN "apps_master_data_bom"."obsolete_reason" IS '失效原因';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "is_obsolete";
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "obsoleted_at";
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "obsolete_reason";
    """
