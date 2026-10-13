from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE apps_kuaizhizao_equipment_spot_check_plans
    ADD COLUMN IF NOT EXISTS scheme_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS shift_ids JSONB;
ALTER TABLE apps_kuaizhizao_equipment_spot_checks
    ADD COLUMN IF NOT EXISTS period_key VARCHAR(100),
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS shift_name VARCHAR(200);
ALTER TABLE apps_kuaizhizao_equipment_spot_check_lines
    ALTER COLUMN is_pass DROP NOT NULL,
    ALTER COLUMN is_pass DROP DEFAULT,
    ADD COLUMN IF NOT EXISTS numeric_min NUMERIC(20,6),
    ADD COLUMN IF NOT EXISTS numeric_max NUMERIC(20,6);
CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_spot_check_plan_task
    ON apps_kuaizhizao_equipment_spot_checks (tenant_id, plan_id, equipment_id, period_key)
    WHERE plan_id IS NOT NULL AND period_key IS NOT NULL AND deleted_at IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    # Pending task results must remain unknown; refuse a lossy rollback.
    return """
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM apps_kuaizhizao_equipment_spot_checks WHERE period_key IS NOT NULL)
    THEN RAISE EXCEPTION 'Plan tasks exist; migrate them before rolling back'; END IF;
    IF EXISTS (SELECT 1 FROM apps_kuaizhizao_equipment_spot_check_lines WHERE is_pass IS NULL)
    THEN RAISE EXCEPTION 'Unknown inspection results exist; resolve them before rolling back'; END IF;
END $$;
DROP INDEX IF EXISTS uq_equipment_spot_check_plan_task;
ALTER TABLE apps_kuaizhizao_equipment_spot_check_plans
    DROP COLUMN IF EXISTS scheme_snapshot, DROP COLUMN IF EXISTS shift_ids;
ALTER TABLE apps_kuaizhizao_equipment_spot_checks
    DROP COLUMN IF EXISTS period_key, DROP COLUMN IF EXISTS scheduled_at,
    DROP COLUMN IF EXISTS due_at, DROP COLUMN IF EXISTS shift_name;
ALTER TABLE apps_kuaizhizao_equipment_spot_check_lines
    DROP COLUMN IF EXISTS numeric_min, DROP COLUMN IF EXISTS numeric_max,
    ALTER COLUMN is_pass SET NOT NULL,
    ALTER COLUMN is_pass SET DEFAULT TRUE;
"""
