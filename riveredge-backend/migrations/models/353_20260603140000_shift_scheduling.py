from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_shifts" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "start_time" TIME NOT NULL,
            "end_time" TIME NOT NULL,
            "crosses_midnight" BOOLEAN NOT NULL DEFAULT FALSE,
            "standard_hours" DECIMAL(6,2) NOT NULL DEFAULT 8,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_master_data_shifts_tenant_id"
            ON "apps_master_data_shifts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shifts_uuid"
            ON "apps_master_data_shifts" ("uuid");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shifts_tenant_code"
            ON "apps_master_data_shifts" ("tenant_id", "code")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_master_data_shifts" IS '基础数据管理 - 班次定义';

        CREATE TABLE IF NOT EXISTS "apps_master_data_shift_rosters" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_group_id" INT NOT NULL,
            "work_group_code" VARCHAR(50),
            "work_group_name" VARCHAR(200),
            "period_start" DATE NOT NULL,
            "period_end" DATE NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "published_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_tenant_id"
            ON "apps_master_data_shift_rosters" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_work_group_id"
            ON "apps_master_data_shift_rosters" ("work_group_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_period_start"
            ON "apps_master_data_shift_rosters" ("period_start");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shift_rosters_wg_period"
            ON "apps_master_data_shift_rosters" ("tenant_id", "work_group_id", "period_start")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_master_data_shift_rosters" IS '基础数据管理 - 排班周期';

        CREATE TABLE IF NOT EXISTS "apps_master_data_shift_assignments" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "roster_id" INT NOT NULL REFERENCES "apps_master_data_shift_rosters" ("id") ON DELETE CASCADE,
            "work_date" DATE NOT NULL,
            "shift_id" INT,
            "employee_id" INT NOT NULL,
            "employee_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_assignments_tenant_id"
            ON "apps_master_data_shift_assignments" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_assignments_roster_id"
            ON "apps_master_data_shift_assignments" ("roster_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_assignments_employee_id"
            ON "apps_master_data_shift_assignments" ("employee_id");
        CREATE INDEX IF NOT EXISTS "idx_master_data_shift_assignments_work_date"
            ON "apps_master_data_shift_assignments" ("work_date");
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_master_data_shift_assignments_roster_emp_date"
            ON "apps_master_data_shift_assignments" ("tenant_id", "roster_id", "employee_id", "work_date")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_master_data_shift_assignments" IS '基础数据管理 - 排班明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_shift_assignments" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_shift_rosters" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_shifts" CASCADE;
    """
