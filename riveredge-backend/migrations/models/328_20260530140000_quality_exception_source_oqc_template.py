"""
质量异常记录检验来源类型；OQC 检验标准/方案模板字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quality_exceptions"
            ADD COLUMN IF NOT EXISTS "inspection_source_type" VARCHAR(50) NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_exceptions_inspection_source_type"
            ON "apps_kuaizhizao_quality_exceptions" ("inspection_source_type");
        COMMENT ON COLUMN "apps_kuaizhizao_quality_exceptions"."inspection_source_type"
            IS '关联检验类型：incoming_inspection/process_inspection/finished_goods_inspection/oqc_inspection';

        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            ADD COLUMN IF NOT EXISTS "inspection_standard" TEXT NULL;
        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            ADD COLUMN IF NOT EXISTS "other_checks" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_oqc_inspections"."inspection_standard" IS '检验标准说明';
        COMMENT ON COLUMN "apps_kuaizhizao_oqc_inspections"."other_checks" IS '检验方案/标准模板（JSON）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            DROP COLUMN IF EXISTS "other_checks";
        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            DROP COLUMN IF EXISTS "inspection_standard";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quality_exceptions_inspection_source_type";
        ALTER TABLE "apps_kuaizhizao_quality_exceptions"
            DROP COLUMN IF EXISTS "inspection_source_type";
    """
