"""
设备点检计划表 + 点检单溯源 plan_id/plan_uuid。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_spot_check_plans" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "plan_no" VARCHAR(100) NOT NULL,
            "plan_name" VARCHAR(200) NOT NULL,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "equipment_items" JSONB,
            "scheme_id" INT NOT NULL,
            "scheme_code" VARCHAR(64),
            "scheme_name" VARCHAR(200),
            "cycle_type" VARCHAR(50),
            "cycle_value" INT,
            "cycle_unit" VARCHAR(20),
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "responsible_person_id" INT,
            "responsible_person_name" VARCHAR(100),
            "status" VARCHAR(50) NOT NULL DEFAULT '草稿',
            "remark" TEXT,
            "attachments" JSONB,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_tenant__spot_check_plan_no" UNIQUE ("tenant_id", "plan_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_tenant" ON "apps_kuaizhizao_equipment_spot_check_plans" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_no" ON "apps_kuaizhizao_equipment_spot_check_plans" ("plan_no");
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_equipment" ON "apps_kuaizhizao_equipment_spot_check_plans" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_scheme" ON "apps_kuaizhizao_equipment_spot_check_plans" ("scheme_id");
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_status" ON "apps_kuaizhizao_equipment_spot_check_plans" ("status");
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_start" ON "apps_kuaizhizao_equipment_spot_check_plans" ("planned_start_date");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_spot_check_plans" IS '快格轻制造 - 设备点检计划';

        ALTER TABLE "apps_kuaizhizao_equipment_spot_checks"
            ADD COLUMN IF NOT EXISTS "plan_id" INT;
        ALTER TABLE "apps_kuaizhizao_equipment_spot_checks"
            ADD COLUMN IF NOT EXISTS "plan_uuid" VARCHAR(36);
        CREATE INDEX IF NOT EXISTS "idx_spot_check_plan_id" ON "apps_kuaizhizao_equipment_spot_checks" ("plan_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_spot_check_plan_id";
        ALTER TABLE "apps_kuaizhizao_equipment_spot_checks" DROP COLUMN IF EXISTS "plan_uuid";
        ALTER TABLE "apps_kuaizhizao_equipment_spot_checks" DROP COLUMN IF EXISTS "plan_id";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_spot_check_plans";
    """
