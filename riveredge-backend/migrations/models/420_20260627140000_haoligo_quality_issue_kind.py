"""好力 GO — 品质问题登记：问题类型（设备/产品）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            ADD COLUMN IF NOT EXISTS "issue_kind" VARCHAR(32);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            DROP COLUMN IF EXISTS "issue_kind";
    """
