"""厂级工作日历配置与加班计划表；并从 APS 排产约束回填工作时段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_work_calendar_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "work_day_start" TIME NOT NULL,
            "work_day_end" TIME NOT NULL,
            "break_start" TIME,
            "break_end" TIME,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_wcc_tenant"
            ON "apps_master_data_work_calendar_configs" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_wcc_tenant_active"
            ON "apps_master_data_work_calendar_configs" ("tenant_id")
            WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "apps_master_data_work_calendar_configs" IS '基础数据管理 - 工作日历配置';

        CREATE TABLE IF NOT EXISTS "apps_master_data_overtime_plans" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "overtime_date" DATE NOT NULL,
            "start_time" TIME NOT NULL,
            "end_time" TIME NOT NULL,
            "name" VARCHAR(200),
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_otp_tenant"
            ON "apps_master_data_overtime_plans" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_otp_date"
            ON "apps_master_data_overtime_plans" ("overtime_date");
        CREATE INDEX IF NOT EXISTS "idx_otp_tenant_date"
            ON "apps_master_data_overtime_plans" ("tenant_id", "overtime_date");
        COMMENT ON TABLE "apps_master_data_overtime_plans" IS '基础数据管理 - 加班计划';

        -- 从 APS 默认排产约束回填工作时段（每租户一条）
        INSERT INTO "apps_master_data_work_calendar_configs" (
            "uuid", "tenant_id", "work_day_start", "work_day_end",
            "break_start", "break_end", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            sc."tenant_id",
            COALESCE(NULLIF(sc."constraints"->>'work_day_start', '')::time, TIME '08:00'),
            COALESCE(NULLIF(sc."constraints"->>'work_day_end', '')::time, TIME '17:00'),
            NULLIF(sc."constraints"->>'break_start', '')::time,
            NULLIF(sc."constraints"->>'break_end', '')::time,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM "apps_kuaizhizao_scheduling_configs" sc
        WHERE sc."is_default" = TRUE
          AND sc."is_active" = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "apps_master_data_work_calendar_configs" w
            WHERE w."tenant_id" = sc."tenant_id" AND w."deleted_at" IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_overtime_plans";
        DROP TABLE IF EXISTS "apps_master_data_work_calendar_configs";
    """
