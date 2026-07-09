"""
好力 GO — 发票明细单价原文字段（保留 OCR/录入时的十进制字符串）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_invoice_line"
            ADD COLUMN IF NOT EXISTS "invoice_unit_price_literal" VARCHAR(64);

        UPDATE "haoligo_finance_invoice_line"
        SET "invoice_unit_price_literal" = "invoice_unit_price"::TEXT
        WHERE "invoice_unit_price_literal" IS NULL OR "invoice_unit_price_literal" = '';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_invoice_line"
            DROP COLUMN IF EXISTS "invoice_unit_price_literal";
    """
