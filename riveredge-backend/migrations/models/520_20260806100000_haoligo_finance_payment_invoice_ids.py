"""
好力 GO — 付款记录支持关联多张发票。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_payment"
            ADD COLUMN IF NOT EXISTS "invoice_ids" JSONB NOT NULL DEFAULT '[]';

        UPDATE "haoligo_finance_payment"
        SET "invoice_ids" = jsonb_build_array("invoice_id")
        WHERE "invoice_id" IS NOT NULL
          AND ("invoice_ids" IS NULL OR "invoice_ids" = '[]'::jsonb);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_payment"
            DROP COLUMN IF EXISTS "invoice_ids";
    """
