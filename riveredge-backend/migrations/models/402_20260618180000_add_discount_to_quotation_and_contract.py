"""
报价单、销售合同增加整单优惠金额（与销售订单 discount_amount 对齐）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12,2) DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."discount_amount" IS '整单优惠金额';

        ALTER TABLE "apps_kuaizhizao_sales_contracts" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12,2) DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_contracts"."discount_amount" IS '整单优惠金额';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "discount_amount";
        ALTER TABLE "apps_kuaizhizao_sales_contracts" DROP COLUMN IF EXISTS "discount_amount";
    """
