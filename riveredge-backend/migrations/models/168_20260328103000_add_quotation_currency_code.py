"""
报价单表增加币种字段 currency_code，默认 CNY（人民币）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations" ADD COLUMN IF NOT EXISTS "currency_code" VARCHAR(20) DEFAULT 'CNY';
        COMMENT ON COLUMN "apps_kuaizhizao_quotations"."currency_code" IS '币种代码（默认 CNY 人民币）';
        UPDATE "apps_kuaizhizao_quotations" SET "currency_code" = 'CNY' WHERE "currency_code" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations" DROP COLUMN IF EXISTS "currency_code";
    """
