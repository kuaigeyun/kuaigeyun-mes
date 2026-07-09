"""
好力 GO — 单价原文改为 TEXT，NUMERIC 扩至可容纳超长小数；展示以 literal 为唯一真源。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price_literal" TYPE TEXT,
            ALTER COLUMN "unit_price" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "new_unit_price" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "invoice_unit_price_literal" TYPE TEXT,
            ALTER COLUMN "invoice_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "system_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "price_diff_amount" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_invoice_line"
            ADD COLUMN IF NOT EXISTS "system_unit_price_literal" TEXT;

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE NUMERIC(1000, 500);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price_literal" TYPE VARCHAR(64),
            ALTER COLUMN "unit_price" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "new_unit_price" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_invoice_line"
            DROP COLUMN IF EXISTS "system_unit_price_literal",
            ALTER COLUMN "invoice_unit_price_literal" TYPE VARCHAR(64),
            ALTER COLUMN "invoice_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "system_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "price_diff_amount" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE DECIMAL(28,14);
    """
