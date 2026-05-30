from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers"
        ADD COLUMN IF NOT EXISTS "contract_billing_mode" VARCHAR(32);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "contract_billing_mode";
    """
