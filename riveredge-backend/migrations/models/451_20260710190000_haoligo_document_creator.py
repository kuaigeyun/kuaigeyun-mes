"""
好力 GO — 单据创建人字段（领用/还入/财务发票/付款）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_borrow_sheet"
            ADD COLUMN IF NOT EXISTS "created_by_user_id" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);

        ALTER TABLE "haoligo_mold_return_sheet"
            ADD COLUMN IF NOT EXISTS "created_by_user_id" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);

        ALTER TABLE "haoligo_finance_invoice"
            ADD COLUMN IF NOT EXISTS "created_by_user_id" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);

        ALTER TABLE "haoligo_finance_payment"
            ADD COLUMN IF NOT EXISTS "created_by_user_id" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_borrow_sheet"
            DROP COLUMN IF EXISTS "created_by_user_id",
            DROP COLUMN IF EXISTS "created_by_name";

        ALTER TABLE "haoligo_mold_return_sheet"
            DROP COLUMN IF EXISTS "created_by_user_id",
            DROP COLUMN IF EXISTS "created_by_name";

        ALTER TABLE "haoligo_finance_invoice"
            DROP COLUMN IF EXISTS "created_by_user_id",
            DROP COLUMN IF EXISTS "created_by_name";

        ALTER TABLE "haoligo_finance_payment"
            DROP COLUMN IF EXISTS "created_by_user_id",
            DROP COLUMN IF EXISTS "created_by_name";
    """
