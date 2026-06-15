"""
盘点单增加明细粒度与零库存选项字段。

Author: AI Assistant
Date: 2026-06-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_stocktakings"
            ADD COLUMN IF NOT EXISTS "line_granularity" VARCHAR(20) NOT NULL DEFAULT 'batch',
            ADD COLUMN IF NOT EXISTS "include_zero_stock" BOOL NOT NULL DEFAULT False;

        COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."line_granularity" IS '明细粒度（material/batch）';
        COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."include_zero_stock" IS '是否包含零库存行';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_stocktakings"
            DROP COLUMN IF EXISTS "line_granularity",
            DROP COLUMN IF EXISTS "include_zero_stock";
    """
