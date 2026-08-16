"""
报价明细增加行情定价取价快照。

Author: AI Assistant
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            ADD COLUMN IF NOT EXISTS "pricing_snapshot" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            DROP COLUMN IF EXISTS "pricing_snapshot";
    """
