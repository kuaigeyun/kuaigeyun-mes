"""
银行账户支持库存现金：account_type，开户行/账号可空。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        ADD COLUMN IF NOT EXISTS "account_type" VARCHAR(20) NOT NULL DEFAULT 'bank';

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        ALTER COLUMN "bank_name" DROP NOT NULL;

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        ALTER COLUMN "account_number" DROP NOT NULL;

        COMMENT ON COLUMN "apps_kuaicaiwu_bank_accounts"."account_type"
            IS '账户类型 bank=银行账户 cash=库存现金';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaicaiwu_bank_accounts"
        SET "bank_name" = COALESCE("bank_name", ''),
            "account_number" = COALESCE("account_number", '')
        WHERE "bank_name" IS NULL OR "account_number" IS NULL;

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        ALTER COLUMN "bank_name" SET NOT NULL;

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        ALTER COLUMN "account_number" SET NOT NULL;

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
        DROP COLUMN IF EXISTS "account_type";
    """
