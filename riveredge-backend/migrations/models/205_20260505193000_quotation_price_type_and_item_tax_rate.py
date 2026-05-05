"""
报价单增加价格类型 price_type（含税/不含税）；报价明细增加税率 tax_rate（%）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "price_type" VARCHAR(20) NOT NULL DEFAULT 'tax_exclusive';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."price_type" IS '价格类型：tax_inclusive 含税单价 / tax_exclusive 不含税单价';
        UPDATE "apps_kuaizhizao_quotations" SET "price_type" = 'tax_exclusive' WHERE "price_type" IS NULL;

        ALTER TABLE "apps_kuaizhizao_quotation_items"
            ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(6,2) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_quotation_items"."tax_rate" IS '税率（%）';
        UPDATE "apps_kuaizhizao_quotation_items" SET "tax_rate" = 0 WHERE "tax_rate" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotation_items" DROP COLUMN IF EXISTS "tax_rate";
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "price_type";
    """
