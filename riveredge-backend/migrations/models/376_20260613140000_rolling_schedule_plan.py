"""
滚动排产计划表迁移

新增 RollingSchedulePlan / RollingSchedulePlanLine。

Author: RiverEdge Team
Date: 2026-06-13
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_rolling_schedule_plans" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "plan_code" VARCHAR(50) NOT NULL,
            "plan_date" DATE NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "prev_plan_date" DATE,
            "closed_at" TIMESTAMPTZ,
            "close_summary" JSONB,
            "published_at" TIMESTAMPTZ,
            "published_by" INT,
            "capacity_advisory" JSONB,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_rolling_schedule_plans" IS '快格轻制造 - 滚动排产计划';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plans"."plan_code" IS '计划编码（RSP…）';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plans"."plan_date" IS '目标工作日';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plans"."status" IS 'draft / published / closed';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plans"."close_summary" IS '关账统计快照';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plans"."capacity_advisory" IS '粗产能提示快照';

        CREATE INDEX IF NOT EXISTS "idx_rsp_tenant_plan_date"
            ON "apps_kuaizhizao_rolling_schedule_plans" ("tenant_id", "plan_date");
        CREATE INDEX IF NOT EXISTS "idx_rsp_tenant_status"
            ON "apps_kuaizhizao_rolling_schedule_plans" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_rsp_plan_code"
            ON "apps_kuaizhizao_rolling_schedule_plans" ("plan_code");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_rsp_tenant_plan_date_active"
            ON "apps_kuaizhizao_rolling_schedule_plans" ("tenant_id", "plan_date")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_rolling_schedule_plan_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "plan_id" INT NOT NULL,
            "work_order_id" INT NOT NULL,
            "sequence" INT NOT NULL DEFAULT 0,
            "planned_quantity" DECIMAL(12,2),
            "source_type" VARCHAR(30) NOT NULL DEFAULT 'manual',
            "readiness_rate_snapshot" DECIMAL(5,2),
            "remarks" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_rolling_schedule_plan_lines" IS '快格轻制造 - 滚动排产计划行';
        COMMENT ON COLUMN "apps_kuaizhizao_rolling_schedule_plan_lines"."source_type" IS 'carry_forward / backlog / already_scheduled / manual';

        CREATE INDEX IF NOT EXISTS "idx_rspl_tenant_plan"
            ON "apps_kuaizhizao_rolling_schedule_plan_lines" ("tenant_id", "plan_id");
        CREATE INDEX IF NOT EXISTS "idx_rspl_plan_sequence"
            ON "apps_kuaizhizao_rolling_schedule_plan_lines" ("plan_id", "sequence");
        CREATE INDEX IF NOT EXISTS "idx_rspl_work_order"
            ON "apps_kuaizhizao_rolling_schedule_plan_lines" ("work_order_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_rolling_schedule_plan_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_rolling_schedule_plans";
    """
