"""
销售订单表补充费用明细与总费用金额列（与 SalesOrder 模型一致）

- fee_details: JSONB，费用明细
- total_fee_amount: 总费用金额

Author: RiverEdge Team
Date: 2026-03-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "fee_details" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."fee_details" IS '费用明细 (JSON)';

        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "total_fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."total_fee_amount" IS '总费用金额';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "fee_details";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "total_fee_amount";
    """
