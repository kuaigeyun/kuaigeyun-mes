"""拆除点检计划：软删计划任务点检单，删除计划表与点检单上的计划字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_equipment_spot_checks"
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE deleted_at IS NULL
          AND status = '待执行'
          AND period_key IS NOT NULL;

        UPDATE "apps_kuaizhizao_equipment_spot_check_lines" AS l
        SET deleted_at = CURRENT_TIMESTAMP
        FROM "apps_kuaizhizao_equipment_spot_checks" AS h
        WHERE l.spot_check_id = h.id
          AND l.deleted_at IS NULL
          AND h.deleted_at IS NOT NULL
          AND h.status = '待执行'
          AND h.period_key IS NOT NULL;

        DROP INDEX IF EXISTS "uq_equipment_spot_check_plan_task";
        DROP INDEX IF EXISTS "idx_spot_check_plan_id";

        ALTER TABLE "apps_kuaizhizao_equipment_spot_checks"
            DROP COLUMN IF EXISTS "plan_id",
            DROP COLUMN IF EXISTS "plan_uuid",
            DROP COLUMN IF EXISTS "period_key",
            DROP COLUMN IF EXISTS "scheduled_at",
            DROP COLUMN IF EXISTS "due_at",
            DROP COLUMN IF EXISTS "shift_name";

        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_spot_check_plans";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 点检计划功能已拆除，拒绝无损回滚。
        DO $$ BEGIN
            RAISE EXCEPTION 'equipment spot-check plans removed; recreate from historical migrations if needed';
        END $$;
    """
