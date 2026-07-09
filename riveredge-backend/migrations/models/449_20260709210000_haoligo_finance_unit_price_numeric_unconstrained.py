"""
好力 GO — 单价 NUMERIC 改为无固定 scale，避免读回填充数百位尾零；精度以 literal TEXT 为准。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price" TYPE NUMERIC USING "unit_price"::NUMERIC;

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE NUMERIC USING "old_unit_price"::NUMERIC,
            ALTER COLUMN "new_unit_price" TYPE NUMERIC USING "new_unit_price"::NUMERIC;

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "invoice_unit_price" TYPE NUMERIC USING "invoice_unit_price"::NUMERIC,
            ALTER COLUMN "system_unit_price" TYPE NUMERIC USING "system_unit_price"::NUMERIC,
            ALTER COLUMN "price_diff_amount" TYPE NUMERIC USING "price_diff_amount"::NUMERIC;

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE NUMERIC USING "unit_price"::NUMERIC;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "new_unit_price" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "invoice_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "system_unit_price" TYPE NUMERIC(1000, 500),
            ALTER COLUMN "price_diff_amount" TYPE NUMERIC(1000, 500);

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE NUMERIC(1000, 500);
    """
