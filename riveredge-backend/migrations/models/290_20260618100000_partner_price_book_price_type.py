"""价格本增加价类字段（含税/不含税，默认含税）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_partner_price_books"
            ADD COLUMN IF NOT EXISTS "price_type" VARCHAR(20) NOT NULL DEFAULT 'tax_inclusive';
        COMMENT ON COLUMN "apps_master_data_partner_price_books"."price_type"
            IS '价类：tax_inclusive 含税 / tax_exclusive 不含税';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_partner_price_books"
            DROP COLUMN IF EXISTS "price_type";
    """
