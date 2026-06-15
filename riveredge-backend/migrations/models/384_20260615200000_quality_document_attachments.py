from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_incoming_inspections"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_incoming_inspections"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_process_inspections"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_process_inspections"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_finished_goods_inspections"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_finished_goods_inspections"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_oqc_inspections"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_defect_records"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_quality_8d_reports"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_quality_8d_reports"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_inspection_plans"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_inspection_plans"."attachments" IS '附件列表';
    """
