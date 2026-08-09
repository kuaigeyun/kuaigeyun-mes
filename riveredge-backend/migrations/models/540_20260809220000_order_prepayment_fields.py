"""
采购/销售订单预付款字段。

Author: AI Assistant
Date: 2026-08-09
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_orders"
            ADD COLUMN IF NOT EXISTS "prepayment_amount" DECIMAL(12,2),
            ADD COLUMN IF NOT EXISTS "prepayment_bank_account_id" INT;

        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ADD COLUMN IF NOT EXISTS "prepayment_amount" DECIMAL(12,2),
            ADD COLUMN IF NOT EXISTS "prepayment_bank_account_id" INT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            DROP COLUMN IF EXISTS "prepayment_bank_account_id",
            DROP COLUMN IF EXISTS "prepayment_amount";

        ALTER TABLE "apps_kuaizhizao_purchase_orders"
            DROP COLUMN IF EXISTS "prepayment_bank_account_id",
            DROP COLUMN IF EXISTS "prepayment_amount";
    """
