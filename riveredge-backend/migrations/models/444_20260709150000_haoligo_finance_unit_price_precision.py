"""
好力 GO — 财务单价字段扩精度（DECIMAL 18,4 → 28,14），避免导入/比对丢精度。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "new_unit_price" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "invoice_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "system_unit_price" TYPE DECIMAL(28,14),
            ALTER COLUMN "price_diff_amount" TYPE DECIMAL(28,14);

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE DECIMAL(28,14);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_finance_supplier_price"
            ALTER COLUMN "unit_price" TYPE DECIMAL(18,4);

        ALTER TABLE "haoligo_finance_price_change_log"
            ALTER COLUMN "old_unit_price" TYPE DECIMAL(18,4),
            ALTER COLUMN "new_unit_price" TYPE DECIMAL(18,4);

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "invoice_unit_price" TYPE DECIMAL(18,4),
            ALTER COLUMN "system_unit_price" TYPE DECIMAL(18,4),
            ALTER COLUMN "price_diff_amount" TYPE DECIMAL(18,4);

        ALTER TABLE "haoligo_finance_material_acceptance_line"
            ALTER COLUMN "unit_price" TYPE DECIMAL(18,4);
    """
