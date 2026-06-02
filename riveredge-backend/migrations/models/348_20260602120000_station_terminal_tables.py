from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_station_andon_calls" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "call_type" VARCHAR(32) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'open',
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "operation_id" INT,
            "workstation_id" INT,
            "workstation_name" VARCHAR(100),
            "caller_id" INT NOT NULL,
            "caller_name" VARCHAR(100) NOT NULL,
            "remarks" TEXT,
            "acknowledged_at" TIMESTAMPTZ,
            "acknowledged_by" INT,
            "acknowledged_by_name" VARCHAR(100),
            "closed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_station_andon_tenant" ON "apps_kuaizhizao_station_andon_calls" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_station_andon_status" ON "apps_kuaizhizao_station_andon_calls" ("status");
        CREATE INDEX IF NOT EXISTS "idx_station_andon_ws" ON "apps_kuaizhizao_station_andon_calls" ("workstation_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_station_sop_acknowledgments" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "sop_uuid" VARCHAR(64) NOT NULL,
            "work_order_id" INT NOT NULL,
            "operation_id" INT NOT NULL,
            "worker_id" INT NOT NULL,
            "worker_name" VARCHAR(100) NOT NULL,
            "acknowledged_at" TIMESTAMPTZ NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            UNIQUE ("tenant_id", "work_order_id", "operation_id", "sop_uuid", "worker_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_station_sop_ack_tenant" ON "apps_kuaizhizao_station_sop_acknowledgments" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_station_operation_downtimes" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "work_order_id" INT NOT NULL,
            "operation_id" INT NOT NULL,
            "reason_code" VARCHAR(64) NOT NULL,
            "reason_label" VARCHAR(100),
            "started_at" TIMESTAMPTZ NOT NULL,
            "ended_at" TIMESTAMPTZ,
            "operator_id" INT NOT NULL,
            "operator_name" VARCHAR(100) NOT NULL,
            "remarks" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_station_downtime_tenant" ON "apps_kuaizhizao_station_operation_downtimes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_station_downtime_wo_op" ON "apps_kuaizhizao_station_operation_downtimes" ("work_order_id", "operation_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_station_operation_downtimes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_station_sop_acknowledgments";
        DROP TABLE IF EXISTS "apps_kuaizhizao_station_andon_calls";
    """
