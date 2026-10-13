"""
保养计划绑定保养方案；点检计划设备字段可空（设备改由方案绑定展开）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ADD COLUMN IF NOT EXISTS "maintenance_scheme_id" INT;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ADD COLUMN IF NOT EXISTS "scheme_code" VARCHAR(64);
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ADD COLUMN IF NOT EXISTS "scheme_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_maint_plan_scheme"
            ON "apps_kuaizhizao_maintenance_plans" ("maintenance_scheme_id");

        -- 历史回填：取该计划最近一条执行记录上的保养方案
        UPDATE "apps_kuaizhizao_maintenance_plans" AS p
        SET
            maintenance_scheme_id = src.maintenance_scheme_id,
            scheme_code = s.code,
            scheme_name = s.name
        FROM (
            SELECT DISTINCT ON (maintenance_plan_id)
                maintenance_plan_id,
                maintenance_scheme_id
            FROM "apps_kuaizhizao_maintenance_executions"
            WHERE deleted_at IS NULL
              AND maintenance_plan_id IS NOT NULL
              AND maintenance_scheme_id IS NOT NULL
            ORDER BY maintenance_plan_id, updated_at DESC NULLS LAST, id DESC
        ) AS src
        LEFT JOIN "apps_kuaizhizao_equipment_maintenance_schemes" AS s
            ON s.id = src.maintenance_scheme_id
           AND s.deleted_at IS NULL
        WHERE p.id = src.maintenance_plan_id
          AND p.deleted_at IS NULL
          AND p.maintenance_scheme_id IS NULL;

        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_id" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_uuid" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_name" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_name" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_uuid" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_equipment_spot_check_plans"
            ALTER COLUMN "equipment_id" SET NOT NULL;

        DROP INDEX IF EXISTS "idx_maint_plan_scheme";
        ALTER TABLE "apps_kuaizhizao_maintenance_plans" DROP COLUMN IF EXISTS "scheme_name";
        ALTER TABLE "apps_kuaizhizao_maintenance_plans" DROP COLUMN IF EXISTS "scheme_code";
        ALTER TABLE "apps_kuaizhizao_maintenance_plans" DROP COLUMN IF EXISTS "maintenance_scheme_id";
    """
