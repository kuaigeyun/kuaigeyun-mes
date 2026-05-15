"""好力 GO — 点检单显式点检方案快照与行上实测值、类型快照。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_spot_check"
            ADD COLUMN IF NOT EXISTS "inspection_param_set_id" INT REFERENCES "haoligo_inspection_param_set"("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "inspection_param_set_code" VARCHAR(64),
            ADD COLUMN IF NOT EXISTS "inspection_param_set_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_esc_ips" ON "haoligo_equipment_spot_check" ("inspection_param_set_id");

        ALTER TABLE "haoligo_equipment_spot_check_line"
            ADD COLUMN IF NOT EXISTS "sort_order" INT NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "value_type" VARCHAR(32) NOT NULL DEFAULT 'numeric',
            ADD COLUMN IF NOT EXISTS "unit" VARCHAR(32),
            ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS "measured_value" TEXT;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_escl_header_sort" ON "haoligo_equipment_spot_check_line" ("header_id", "sort_order");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_escl_header_sort";
        ALTER TABLE "haoligo_equipment_spot_check_line"
            DROP COLUMN IF EXISTS "measured_value",
            DROP COLUMN IF EXISTS "is_required",
            DROP COLUMN IF EXISTS "unit",
            DROP COLUMN IF EXISTS "value_type",
            DROP COLUMN IF EXISTS "sort_order";

        DROP INDEX IF EXISTS "idx_haoligo_esc_ips";
        ALTER TABLE "haoligo_equipment_spot_check"
            DROP COLUMN IF EXISTS "inspection_param_set_name",
            DROP COLUMN IF EXISTS "inspection_param_set_code",
            DROP COLUMN IF EXISTS "inspection_param_set_id";
    """
