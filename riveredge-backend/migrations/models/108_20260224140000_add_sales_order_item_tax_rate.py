"""
销售订单明细增加税率字段

- tax_rate: 税率（%），默认 0

Author: RiverEdge Team
Date: 2026-02-24
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items" ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(6,2) DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_items"."tax_rate" IS '税率（%）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "tax_rate";
    """
