"""
创建快数采 (kuaiiot) 应用表

apps_kuaiiot_connections / devices / tag_definitions / tag_snapshots / tag_history
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_connections" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "connection_type" VARCHAR(30) NOT NULL,
            "config" JSONB,
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "health_status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
            "last_health_at" TIMESTAMPTZ,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_connections_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_connections_tenant_type" ON "apps_kuaiiot_connections" ("tenant_id", "connection_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_connections_tenant_enabled" ON "apps_kuaiiot_connections" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_devices" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "connection_id" INT,
            "external_device_id" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "device_token" VARCHAR(64) NOT NULL,
            "equipment_uuid" VARCHAR(36),
            "is_online" BOOL NOT NULL DEFAULT False,
            "last_seen_at" TIMESTAMPTZ,
            "last_mes_sync_at" TIMESTAMPTZ,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_devices_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_tenant_conn" ON "apps_kuaiiot_devices" ("tenant_id", "connection_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_tenant_equip" ON "apps_kuaiiot_devices" ("tenant_id", "equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_token" ON "apps_kuaiiot_devices" ("device_token");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_tenant_online" ON "apps_kuaiiot_devices" ("tenant_id", "is_online");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_tag_definitions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "device_id" INT NOT NULL,
            "tag_key" VARCHAR(100) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "value_type" VARCHAR(20) NOT NULL DEFAULT 'number',
            "unit" VARCHAR(30),
            "map_target" VARCHAR(100) NOT NULL,
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_tag_defs_device_key" UNIQUE ("tenant_id", "device_id", "tag_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_tag_defs_tenant_device" ON "apps_kuaiiot_tag_definitions" ("tenant_id", "device_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_tag_snapshots" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "device_id" INT NOT NULL,
            "tag_key" VARCHAR(100) NOT NULL,
            "value_text" TEXT,
            "value_number" DECIMAL(18,6),
            "value_bool" BOOL,
            "quality" VARCHAR(20) NOT NULL DEFAULT 'good',
            "sampled_at" TIMESTAMPTZ NOT NULL,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_tag_snap_device_key" UNIQUE ("tenant_id", "device_id", "tag_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_tag_snap_tenant_device" ON "apps_kuaiiot_tag_snapshots" ("tenant_id", "device_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_tag_snap_sampled" ON "apps_kuaiiot_tag_snapshots" ("sampled_at");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_tag_history" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "device_id" INT NOT NULL,
            "tag_key" VARCHAR(100) NOT NULL,
            "value_text" TEXT,
            "value_number" DECIMAL(18,6),
            "value_bool" BOOL,
            "quality" VARCHAR(20) NOT NULL DEFAULT 'good',
            "sampled_at" TIMESTAMPTZ NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_tag_hist_device_key" ON "apps_kuaiiot_tag_history" ("tenant_id", "device_id", "tag_key");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_tag_hist_sampled" ON "apps_kuaiiot_tag_history" ("sampled_at");

        COMMENT ON TABLE "apps_kuaiiot_connections" IS '快数采 - 连接源';
        COMMENT ON TABLE "apps_kuaiiot_devices" IS '快数采 - IoT 设备';
        COMMENT ON TABLE "apps_kuaiiot_tag_definitions" IS '快数采 - 点位定义';
        COMMENT ON TABLE "apps_kuaiiot_tag_snapshots" IS '快数采 - 点位快照';
        COMMENT ON TABLE "apps_kuaiiot_tag_history" IS '快数采 - 点位历史';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiiot_tag_history";
        DROP TABLE IF EXISTS "apps_kuaiiot_tag_snapshots";
        DROP TABLE IF EXISTS "apps_kuaiiot_tag_definitions";
        DROP TABLE IF EXISTS "apps_kuaiiot_devices";
        DROP TABLE IF EXISTS "apps_kuaiiot_connections";
    """
