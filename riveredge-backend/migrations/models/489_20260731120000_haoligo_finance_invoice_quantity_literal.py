"""
好力 GO — 发票数量改为无固定 scale NUMERIC，并增加 quantity_literal 原文；
展示/录入以 literal 为唯一精度真源，避免 DECIMAL(18,4) 取整或补零。
验收单数量同步改为无约束 NUMERIC，避免由发票生成验收时二次丢精度。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_invoice_line"
            ADD COLUMN IF NOT EXISTS "quantity_literal" TEXT,
            ALTER COLUMN "quantity" TYPE NUMERIC USING "quantity"::NUMERIC;

        UPDATE "haoligo_finance_invoice_line"
        SET "quantity_literal" = "quantity"::TEXT
        WHERE "quantity_literal" IS NULL OR "quantity_literal" = '';

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "quantity" TYPE NUMERIC USING "quantity"::NUMERIC;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_invoice_line"
            DROP COLUMN IF EXISTS "quantity_literal",
            ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING ROUND("quantity"::NUMERIC, 4);

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "quantity" TYPE DECIMAL(18, 4) USING ROUND("quantity"::NUMERIC, 4);
    """
