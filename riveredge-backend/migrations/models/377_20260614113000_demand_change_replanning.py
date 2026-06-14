"""
需求计算变更重算能力迁移

新增：
- 需求变更事件表
- 需求影响记录表
- 需求重算任务表
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_change_events" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "event_code" VARCHAR(64) NOT NULL,
            "event_type" VARCHAR(32) NOT NULL,
            "source_type" VARCHAR(64) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(64),
            "source_name" VARCHAR(200),
            "changed_fields" JSONB,
            "payload" JSONB,
            "effective_at" TIMESTAMPTZ,
            "event_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "trigger_reason" VARCHAR(200),
            "requested_by" INT,
            "correlation_id" VARCHAR(64),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_change_events" IS '快格轻制造 - 需求计算变更事件';

        CREATE INDEX IF NOT EXISTS "idx_dce_tenant_event_type"
            ON "apps_kuaizhizao_demand_change_events" ("tenant_id", "event_type");
        CREATE INDEX IF NOT EXISTS "idx_dce_tenant_source"
            ON "apps_kuaizhizao_demand_change_events" ("tenant_id", "source_type", "source_id");
        CREATE INDEX IF NOT EXISTS "idx_dce_tenant_status"
            ON "apps_kuaizhizao_demand_change_events" ("tenant_id", "event_status");
        CREATE INDEX IF NOT EXISTS "idx_dce_event_code"
            ON "apps_kuaizhizao_demand_change_events" ("event_code");
        CREATE INDEX IF NOT EXISTS "idx_dce_correlation_id"
            ON "apps_kuaizhizao_demand_change_events" ("correlation_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_impact_records" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "event_id" INT NOT NULL,
            "impact_type" VARCHAR(32) NOT NULL,
            "impact_id" INT NOT NULL,
            "impact_code" VARCHAR(64),
            "impact_scope" VARCHAR(32) NOT NULL DEFAULT 'direct',
            "impact_reason" VARCHAR(200) NOT NULL,
            "impact_payload" JSONB,
            "risk_level" VARCHAR(20) NOT NULL DEFAULT 'low',
            "needs_approval" BOOL NOT NULL DEFAULT FALSE,
            "frozen_horizon_hit" BOOL NOT NULL DEFAULT FALSE,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_impact_records" IS '快格轻制造 - 需求计算影响记录';

        CREATE INDEX IF NOT EXISTS "idx_dir_tenant_event"
            ON "apps_kuaizhizao_demand_impact_records" ("tenant_id", "event_id");
        CREATE INDEX IF NOT EXISTS "idx_dir_tenant_impact"
            ON "apps_kuaizhizao_demand_impact_records" ("tenant_id", "impact_type", "impact_id");
        CREATE INDEX IF NOT EXISTS "idx_dir_tenant_risk"
            ON "apps_kuaizhizao_demand_impact_records" ("tenant_id", "risk_level");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_replan_tasks" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "event_id" INT NOT NULL,
            "task_code" VARCHAR(64) NOT NULL,
            "mode" VARCHAR(20) NOT NULL DEFAULT 'net_change',
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "priority" INT NOT NULL DEFAULT 5,
            "risk_level" VARCHAR(20) NOT NULL DEFAULT 'low',
            "approval_status" VARCHAR(20) NOT NULL DEFAULT 'not_required',
            "approval_comment" TEXT,
            "auto_apply" BOOL NOT NULL DEFAULT FALSE,
            "threshold_exceeded" BOOL NOT NULL DEFAULT FALSE,
            "task_scope" JSONB,
            "impact_metrics" JSONB,
            "result_summary" JSONB,
            "started_at" TIMESTAMPTZ,
            "finished_at" TIMESTAMPTZ,
            "operator_id" INT,
            "approved_by" INT,
            "approved_at" TIMESTAMPTZ,
            "error_message" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_kuaizhizao_demand_replan_tasks" IS '快格轻制造 - 需求重算任务';

        CREATE INDEX IF NOT EXISTS "idx_drt_tenant_event"
            ON "apps_kuaizhizao_demand_replan_tasks" ("tenant_id", "event_id");
        CREATE INDEX IF NOT EXISTS "idx_drt_tenant_mode"
            ON "apps_kuaizhizao_demand_replan_tasks" ("tenant_id", "mode");
        CREATE INDEX IF NOT EXISTS "idx_drt_tenant_status"
            ON "apps_kuaizhizao_demand_replan_tasks" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_drt_tenant_approval"
            ON "apps_kuaizhizao_demand_replan_tasks" ("tenant_id", "approval_status");
        CREATE INDEX IF NOT EXISTS "idx_drt_task_code"
            ON "apps_kuaizhizao_demand_replan_tasks" ("task_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_replan_tasks";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_impact_records";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_change_events";
    """
