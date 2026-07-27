"""工位并行度、工作日历班次来源、工位停机窗。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_workstations"
            ADD COLUMN IF NOT EXISTS "max_parallel" INT NOT NULL DEFAULT 1;
        COMMENT ON COLUMN "apps_master_data_workstations"."max_parallel"
            IS '同刻最大并行工序数';

        ALTER TABLE "apps_master_data_work_calendar_configs"
            ADD COLUMN IF NOT EXISTS "window_source" VARCHAR(20) NOT NULL DEFAULT 'fixed';
        COMMENT ON COLUMN "apps_master_data_work_calendar_configs"."window_source"
            IS '窗口来源：fixed / shift';

        CREATE TABLE IF NOT EXISTS "apps_master_data_station_unavailable_windows" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "station_id" INT NOT NULL,
            "start_at" TIMESTAMPTZ NOT NULL,
            "end_at" TIMESTAMPTZ NOT NULL,
            "reason" VARCHAR(200),
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_suw_tenant"
            ON "apps_master_data_station_unavailable_windows" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_suw_station"
            ON "apps_master_data_station_unavailable_windows" ("station_id");
        CREATE INDEX IF NOT EXISTS "idx_suw_tenant_station"
            ON "apps_master_data_station_unavailable_windows" ("tenant_id", "station_id");
        COMMENT ON TABLE "apps_master_data_station_unavailable_windows"
            IS '基础数据管理 - 工位停机窗';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_station_unavailable_windows";
        ALTER TABLE "apps_master_data_work_calendar_configs"
            DROP COLUMN IF EXISTS "window_source";
        ALTER TABLE "apps_master_data_workstations"
            DROP COLUMN IF EXISTS "max_parallel";
    """
