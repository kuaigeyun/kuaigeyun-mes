"""
为 apps_kuaizhizao_reporting_records 增加 deleted_at，与 ReportingRecord 模型一致（软删除字段，默认可空）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_reporting_records"
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_reporting_records"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_reporting_records" DROP COLUMN IF EXISTS "deleted_at";
    """
