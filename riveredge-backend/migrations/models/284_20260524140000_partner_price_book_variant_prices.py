"""价格本：属性 SKU 单价矩阵（variant_prices JSON）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_partner_price_books"
            ADD COLUMN IF NOT EXISTS "variant_prices" JSONB;
        ALTER TABLE "apps_master_data_partner_price_books"
            ALTER COLUMN "unit_price" DROP NOT NULL;
        COMMENT ON COLUMN "apps_master_data_partner_price_books"."variant_prices"
            IS '按属性组合定价 [{variant_attributes, unit_price}]；未匹配时回退 unit_price 标准价';
        COMMENT ON COLUMN "apps_master_data_partner_price_books"."unit_price"
            IS '标准价（统一价）；无属性匹配时使用';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_partner_price_books"
            DROP COLUMN IF EXISTS "variant_prices";
    """
