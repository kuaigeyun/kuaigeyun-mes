"""
8D 报告关联不合格品台账
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            ADD COLUMN IF NOT EXISTS "defect_record_id" INT NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_defect_record_id"
            ON "apps_kuaizhizao_quality_8d_reports" ("defect_record_id");
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_reports"."defect_record_id"
            IS '关联不合格品台账ID（可选）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quality_8d_reports_defect_record_id";
        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            DROP COLUMN IF EXISTS "defect_record_id";
    """
