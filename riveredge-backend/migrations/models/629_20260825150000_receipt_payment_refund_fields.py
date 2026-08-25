"""
收款单/付款单：退款执行态字段。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_receipts"
            ADD COLUMN IF NOT EXISTS "refunded_amount" DECIMAL(16,4) NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaicaiwu_receipts"
            ADD COLUMN IF NOT EXISTS "refund_execution_status" VARCHAR(20) NOT NULL DEFAULT '未退款';
        ALTER TABLE "apps_kuaicaiwu_payments"
            ADD COLUMN IF NOT EXISTS "refunded_amount" DECIMAL(16,4) NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaicaiwu_payments"
            ADD COLUMN IF NOT EXISTS "refund_execution_status" VARCHAR(20) NOT NULL DEFAULT '未退款';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_receipts" DROP COLUMN IF EXISTS "refunded_amount";
        ALTER TABLE "apps_kuaicaiwu_receipts" DROP COLUMN IF EXISTS "refund_execution_status";
        ALTER TABLE "apps_kuaicaiwu_payments" DROP COLUMN IF EXISTS "refunded_amount";
        ALTER TABLE "apps_kuaicaiwu_payments" DROP COLUMN IF EXISTS "refund_execution_status";
    """
