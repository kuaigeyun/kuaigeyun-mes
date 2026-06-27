"""好力 GO — 品质问题登记：计划数量、完成数量、不良率。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            ADD COLUMN IF NOT EXISTS "planned_qty" DECIMAL(18,6),
            ADD COLUMN IF NOT EXISTS "completed_qty" DECIMAL(18,6),
            ADD COLUMN IF NOT EXISTS "defect_rate" DECIMAL(8,2);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_quality_issue_tracking"
            DROP COLUMN IF EXISTS "defect_rate",
            DROP COLUMN IF EXISTS "completed_qty",
            DROP COLUMN IF EXISTS "planned_qty";
    """
