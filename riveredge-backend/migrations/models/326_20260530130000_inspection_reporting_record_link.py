"""
过程/成品检验单关联报工记录（自动触发幂等）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_process_inspections"
            ADD COLUMN IF NOT EXISTS "reporting_record_id" INT NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_process_inspections_reporting_record_id"
            ON "apps_kuaizhizao_process_inspections" ("reporting_record_id");
        COMMENT ON COLUMN "apps_kuaizhizao_process_inspections"."reporting_record_id"
            IS '报工记录ID（自动触发过程检验时关联）';

        ALTER TABLE "apps_kuaizhizao_finished_goods_inspections"
            ADD COLUMN IF NOT EXISTS "reporting_record_id" INT NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_finished_goods_inspections_reporting_record_id"
            ON "apps_kuaizhizao_finished_goods_inspections" ("reporting_record_id");
        COMMENT ON COLUMN "apps_kuaizhizao_finished_goods_inspections"."reporting_record_id"
            IS '报工记录ID（自动触发成品检验时关联）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_finished_goods_inspections_reporting_record_id";
        ALTER TABLE "apps_kuaizhizao_finished_goods_inspections"
            DROP COLUMN IF EXISTS "reporting_record_id";

        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_process_inspections_reporting_record_id";
        ALTER TABLE "apps_kuaizhizao_process_inspections"
            DROP COLUMN IF EXISTS "reporting_record_id";
    """
