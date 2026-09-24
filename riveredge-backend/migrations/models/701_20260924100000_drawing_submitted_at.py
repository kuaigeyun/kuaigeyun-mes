"""工程图纸：提交签审时刻（审批链与待审提醒）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
        ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "apps_master_data_engineering_drawings"."submitted_at"
            IS '提交签审时间';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
        DROP COLUMN IF EXISTS "submitted_at";
    """
