"""
销售订单增加含税/不含税、整单优惠字段

- price_type: 含税/不含税（tax_inclusive/tax_exclusive）
- discount_amount: 整单优惠金额

Author: RiverEdge Team
Date: 2026-02-24
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "price_type" VARCHAR(20) DEFAULT 'tax_exclusive';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."price_type" IS '价格类型：含税(tax_inclusive)/不含税(tax_exclusive)';

        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12,2) DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."discount_amount" IS '整单优惠金额';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "price_type";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "discount_amount";
    """
