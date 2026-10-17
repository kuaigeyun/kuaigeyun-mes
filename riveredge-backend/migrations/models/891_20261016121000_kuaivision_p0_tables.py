"""快视觉 P0：边缘节点、检测事件、测量值、原图引用。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaivision_agents" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "device_token" VARCHAR(64) NOT NULL,
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "last_heartbeat_at" TIMESTAMPTZ,
            "config_version" INT NOT NULL DEFAULT 1,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_agents_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_agents_token"
            ON "apps_kuaivision_agents" ("device_token");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_agents_tenant_enabled"
            ON "apps_kuaivision_agents" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_inspection_events" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "event_id" VARCHAR(100) NOT NULL,
            "agent_id" INT,
            "occurred_at" TIMESTAMPTZ NOT NULL,
            "judgment" VARCHAR(20) NOT NULL,
            "confidence" DECIMAL(8,4),
            "recipe_code" VARCHAR(50),
            "recipe_version" VARCHAR(30),
            "station_code" VARCHAR(50),
            "camera_code" VARCHAR(50),
            "work_order_code" VARCHAR(50),
            "operation_code" VARCHAR(50),
            "batch_no" VARCHAR(100),
            "duration_ms" INT,
            "step_results" JSONB,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_events_tenant_event" UNIQUE ("tenant_id", "event_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_events_occurred"
            ON "apps_kuaivision_inspection_events" ("tenant_id", "occurred_at");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_events_judgment"
            ON "apps_kuaivision_inspection_events" ("tenant_id", "judgment");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_events_station"
            ON "apps_kuaivision_inspection_events" ("tenant_id", "station_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_events_recipe"
            ON "apps_kuaivision_inspection_events" ("tenant_id", "recipe_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_measurements" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "event_id" INT NOT NULL,
            "name" VARCHAR(80) NOT NULL,
            "value" DECIMAL(18,6),
            "unit" VARCHAR(20),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_measurements_event"
            ON "apps_kuaivision_measurements" ("tenant_id", "event_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_inspection_images" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "event_id" INT NOT NULL,
            "object_key" VARCHAR(500) NOT NULL,
            "label" VARCHAR(80),
            "sort_order" INT NOT NULL DEFAULT 0,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_images_event"
            ON "apps_kuaivision_inspection_images" ("tenant_id", "event_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaivision_inspection_images";
        DROP TABLE IF EXISTS "apps_kuaivision_measurements";
        DROP TABLE IF EXISTS "apps_kuaivision_inspection_events";
        DROP TABLE IF EXISTS "apps_kuaivision_agents";
    """
