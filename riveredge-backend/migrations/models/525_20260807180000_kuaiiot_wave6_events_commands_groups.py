"""
快数采 Wave 6：物模型 events/functions、设备分组、指令下发、消息追踪
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_products"
            ADD COLUMN IF NOT EXISTS "events" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "apps_kuaiiot_products"
            ADD COLUMN IF NOT EXISTS "functions" JSONB NOT NULL DEFAULT '[]';

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_device_groups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_by" INT,
            "deleted_by_name" VARCHAR(100),
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "parent_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_device_groups_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_device_groups_tenant_parent"
            ON "apps_kuaiiot_device_groups" ("tenant_id", "parent_id");

        ALTER TABLE "apps_kuaiiot_devices"
            ADD COLUMN IF NOT EXISTS "group_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_tenant_group"
            ON "apps_kuaiiot_devices" ("tenant_id", "group_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_device_commands" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_by" INT,
            "deleted_by_name" VARCHAR(100),
            "device_id" INT NOT NULL,
            "function_key" VARCHAR(100) NOT NULL,
            "params" JSONB NOT NULL DEFAULT '{}',
            "dispatch_channel" VARCHAR(30) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "result" JSONB,
            "error_message" TEXT,
            "requested_by" INT,
            "sent_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "expires_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_device_commands_tenant_device"
            ON "apps_kuaiiot_device_commands" ("tenant_id", "device_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_device_commands_status_expires"
            ON "apps_kuaiiot_device_commands" ("tenant_id", "status", "expires_at");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_message_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_by" INT,
            "deleted_by_name" VARCHAR(100),
            "device_id" INT NOT NULL,
            "direction" VARCHAR(10) NOT NULL,
            "msg_type" VARCHAR(30) NOT NULL,
            "payload" JSONB,
            "result" VARCHAR(20) NOT NULL,
            "error_message" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_message_logs_tenant_device_created"
            ON "apps_kuaiiot_message_logs" ("tenant_id", "device_id", "created_at");

        ALTER TABLE "apps_kuaiiot_alerts"
            ALTER COLUMN "rule_id" DROP NOT NULL;

        COMMENT ON TABLE "apps_kuaiiot_device_groups" IS '快数采 - 设备分组';
        COMMENT ON TABLE "apps_kuaiiot_device_commands" IS '快数采 - 设备指令';
        COMMENT ON TABLE "apps_kuaiiot_message_logs" IS '快数采 - 消息追踪';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_alerts"
            ALTER COLUMN "rule_id" SET NOT NULL;

        DROP TABLE IF EXISTS "apps_kuaiiot_message_logs";
        DROP TABLE IF EXISTS "apps_kuaiiot_device_commands";

        DROP INDEX IF EXISTS "idx_apps_kuaiiot_devices_tenant_group";
        ALTER TABLE "apps_kuaiiot_devices" DROP COLUMN IF EXISTS "group_id";

        DROP TABLE IF EXISTS "apps_kuaiiot_device_groups";

        ALTER TABLE "apps_kuaiiot_products" DROP COLUMN IF EXISTS "functions";
        ALTER TABLE "apps_kuaiiot_products" DROP COLUMN IF EXISTS "events";
    """
