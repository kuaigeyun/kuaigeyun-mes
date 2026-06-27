"""好力 GO — 客户投诉：批次号。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_customer_complaint"
            ADD COLUMN IF NOT EXISTS "batch_no" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_customer_complaint"
            DROP COLUMN IF EXISTS "batch_no";
    """
