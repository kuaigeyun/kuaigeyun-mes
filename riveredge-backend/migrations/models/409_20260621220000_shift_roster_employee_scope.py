from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_shift_rosters"
            ADD COLUMN IF NOT EXISTS "scope_type" VARCHAR(20) NOT NULL DEFAULT 'work_group',
            ADD COLUMN IF NOT EXISTS "employee_id" INT,
            ADD COLUMN IF NOT EXISTS "employee_name" VARCHAR(100);

        ALTER TABLE "apps_master_data_shift_rosters"
            ALTER COLUMN "work_group_id" DROP NOT NULL;

        DROP INDEX IF EXISTS "idx_master_data_shift_rosters_wg_period";

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_wg_period"
            ON "apps_master_data_shift_rosters" ("tenant_id", "work_group_id", "period_start")
            WHERE "deleted_at" IS NULL
              AND "scope_type" = 'work_group'
              AND "work_group_id" IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_emp_period"
            ON "apps_master_data_shift_rosters" ("tenant_id", "employee_id", "period_start")
            WHERE "deleted_at" IS NULL
              AND "scope_type" = 'employee'
              AND "employee_id" IS NOT NULL;

        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_employee_id"
            ON "apps_master_data_shift_rosters" ("employee_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_master_data_shift_rosters_employee_id";
        DROP INDEX IF EXISTS "idx_master_data_shift_rosters_emp_period";
        DROP INDEX IF EXISTS "idx_master_data_shift_rosters_wg_period";

        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_wg_period"
            ON "apps_master_data_shift_rosters" ("tenant_id", "work_group_id", "period_start")
            WHERE "deleted_at" IS NULL;

        ALTER TABLE "apps_master_data_shift_rosters"
            DROP COLUMN IF EXISTS "employee_name",
            DROP COLUMN IF EXISTS "employee_id",
            DROP COLUMN IF EXISTS "scope_type";
    """
