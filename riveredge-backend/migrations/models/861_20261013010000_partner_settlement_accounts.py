"""
客户/供应商收付款账户明细（JSON 数组，与联系人同级存储）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers"
        ADD COLUMN IF NOT EXISTS "settlement_accounts" JSONB NOT NULL DEFAULT '[]';
        COMMENT ON COLUMN "apps_master_data_customers"."settlement_accounts"
            IS '收付款账户明细 JSON 数组';

        ALTER TABLE "apps_master_data_suppliers"
        ADD COLUMN IF NOT EXISTS "settlement_accounts" JSONB NOT NULL DEFAULT '[]';
        COMMENT ON COLUMN "apps_master_data_suppliers"."settlement_accounts"
            IS '收付款账户明细 JSON 数组';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "settlement_accounts";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "settlement_accounts";
    """
