"""
应收/应付单增加退款执行态字段（与收付款单 refund_execution_status 对齐）。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_receivables"
            ADD COLUMN IF NOT EXISTS "refunded_amount" DECIMAL(14,4) NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaicaiwu_receivables"
            ADD COLUMN IF NOT EXISTS "refund_execution_status" VARCHAR(20) NOT NULL DEFAULT '未退款';

        ALTER TABLE "apps_kuaicaiwu_payables"
            ADD COLUMN IF NOT EXISTS "refunded_amount" DECIMAL(14,4) NOT NULL DEFAULT 0;
        ALTER TABLE "apps_kuaicaiwu_payables"
            ADD COLUMN IF NOT EXISTS "refund_execution_status" VARCHAR(20) NOT NULL DEFAULT '未退款';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_receivables" DROP COLUMN IF EXISTS "refund_execution_status";
        ALTER TABLE "apps_kuaicaiwu_receivables" DROP COLUMN IF EXISTS "refunded_amount";
        ALTER TABLE "apps_kuaicaiwu_payables" DROP COLUMN IF EXISTS "refund_execution_status";
        ALTER TABLE "apps_kuaicaiwu_payables" DROP COLUMN IF EXISTS "refunded_amount";
    """
