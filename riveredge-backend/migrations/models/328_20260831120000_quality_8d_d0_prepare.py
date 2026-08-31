"""
8D 报告补齐 D0 准备阶段字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            ADD COLUMN IF NOT EXISTS "d0_prepare" TEXT NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_reports"."d0_prepare"
            IS 'D0 准备与紧急响应';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            DROP COLUMN IF EXISTS "d0_prepare";
    """
