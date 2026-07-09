"""
好力 GO — 单价原文字段（保留导入时的十进制字符串，与 DECIMAL 分离存储）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ADD COLUMN IF NOT EXISTS "unit_price_literal" VARCHAR(64);

        UPDATE "haoligo_finance_supplier_price"
        SET "unit_price_literal" = "unit_price"::TEXT
        WHERE "unit_price_literal" IS NULL OR "unit_price_literal" = '';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            DROP COLUMN IF EXISTS "unit_price_literal";
    """
