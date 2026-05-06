from tortoise import BaseDBAsyncClient


SQL = """
        ALTER TABLE "apps_master_data_customers" ADD "revenue_recognition_override" VARCHAR(32);
        ALTER TABLE "apps_master_data_suppliers" ADD "payable_recognition_override" VARCHAR(32);
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    return SQL


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "revenue_recognition_override";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "payable_recognition_override";
    """
