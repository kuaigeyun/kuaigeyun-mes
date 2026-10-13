"""
保养方案增加维护类型/周期真源；保养计划设备与类型/周期字段可空（改由方案+绑定展开）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            ADD COLUMN IF NOT EXISTS "maintenance_type" VARCHAR(50);
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            ADD COLUMN IF NOT EXISTS "cycle_type" VARCHAR(50);
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            ADD COLUMN IF NOT EXISTS "cycle_value" INT;
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            ADD COLUMN IF NOT EXISTS "cycle_unit" VARCHAR(20);

        -- 历史回填：取引用该方案的最近一条保养计划上的类型/周期
        UPDATE "apps_kuaizhizao_equipment_maintenance_schemes" AS s
        SET
            maintenance_type = COALESCE(s.maintenance_type, src.maintenance_type),
            cycle_type = COALESCE(s.cycle_type, src.cycle_type),
            cycle_value = COALESCE(s.cycle_value, src.cycle_value),
            cycle_unit = COALESCE(s.cycle_unit, src.cycle_unit)
        FROM (
            SELECT DISTINCT ON (maintenance_scheme_id)
                maintenance_scheme_id,
                maintenance_type,
                cycle_type,
                cycle_value,
                cycle_unit
            FROM "apps_kuaizhizao_maintenance_plans"
            WHERE deleted_at IS NULL
              AND maintenance_scheme_id IS NOT NULL
            ORDER BY maintenance_scheme_id, updated_at DESC NULLS LAST, id DESC
        ) AS src
        WHERE s.id = src.maintenance_scheme_id
          AND s.deleted_at IS NULL;

        UPDATE "apps_kuaizhizao_equipment_maintenance_schemes"
        SET
            maintenance_type = COALESCE(maintenance_type, '日常保养'),
            cycle_type = COALESCE(cycle_type, '按时间'),
            cycle_value = COALESCE(cycle_value, 30),
            cycle_unit = COALESCE(cycle_unit, '天')
        WHERE deleted_at IS NULL;

        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_id" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_uuid" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_name" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "maintenance_type" DROP NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "cycle_type" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "cycle_type" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "maintenance_type" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_name" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_uuid" SET NOT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_plans"
            ALTER COLUMN "equipment_id" SET NOT NULL;

        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            DROP COLUMN IF EXISTS "cycle_unit";
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            DROP COLUMN IF EXISTS "cycle_value";
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            DROP COLUMN IF EXISTS "cycle_type";
        ALTER TABLE "apps_kuaizhizao_equipment_maintenance_schemes"
            DROP COLUMN IF EXISTS "maintenance_type";
    """
