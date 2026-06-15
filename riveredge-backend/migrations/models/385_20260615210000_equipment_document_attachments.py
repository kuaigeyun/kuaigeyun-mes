from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_molds"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_tools"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_equipment_faults"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_equipment_repairs"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_repairs"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_plans"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_maintenance_reminders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_reminders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_equipment_status_monitors"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_status_monitors"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_mold_usages"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_mold_calibrations"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_mold_calibrations"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_tool_usages"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_tool_usages"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_tool_maintenances"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_tool_maintenances"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_tool_calibrations"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_tool_calibrations"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_equipment_calibrations"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_calibrations"."attachments" IS '附件列表';
    """
