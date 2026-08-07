"""
快数采 Wave 2：告警规则/记录、边缘 Agent 配置、点位 fill_target
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_alert_rules" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "device_id" INT,
            "equipment_uuid" VARCHAR(36),
            "tag_key" VARCHAR(100) NOT NULL,
            "operator" VARCHAR(10) NOT NULL,
            "threshold_number" DECIMAL(18,6),
            "threshold_text" VARCHAR(200),
            "severity" VARCHAR(20) NOT NULL DEFAULT 'warning',
            "cooldown_seconds" INT NOT NULL DEFAULT 300,
            "notify_enabled" BOOL NOT NULL DEFAULT False,
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_alert_rules_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alert_rules_tenant_device" ON "apps_kuaiiot_alert_rules" ("tenant_id", "device_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alert_rules_tenant_equip" ON "apps_kuaiiot_alert_rules" ("tenant_id", "equipment_uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alert_rules_tenant_enabled" ON "apps_kuaiiot_alert_rules" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_alerts" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "rule_id" INT NOT NULL,
            "device_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36),
            "tag_key" VARCHAR(100) NOT NULL,
            "severity" VARCHAR(20) NOT NULL,
            "message" TEXT NOT NULL,
            "actual_value" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'open',
            "triggered_at" TIMESTAMPTZ NOT NULL,
            "acknowledged_at" TIMESTAMPTZ,
            "acknowledged_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alerts_tenant_status" ON "apps_kuaiiot_alerts" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alerts_tenant_device" ON "apps_kuaiiot_alerts" ("tenant_id", "device_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alerts_triggered" ON "apps_kuaiiot_alerts" ("triggered_at");

        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_edge_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "device_id" INT NOT NULL,
            "protocol" VARCHAR(30) NOT NULL DEFAULT 'modbus_tcp',
            "config" JSONB NOT NULL,
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_edge_configs_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_edge_configs_tenant_device" ON "apps_kuaiiot_edge_configs" ("tenant_id", "device_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_edge_configs_tenant_enabled" ON "apps_kuaiiot_edge_configs" ("tenant_id", "is_enabled");

        ALTER TABLE "apps_kuaiiot_tag_definitions"
            ADD COLUMN IF NOT EXISTS "fill_target" VARCHAR(100);

        COMMENT ON TABLE "apps_kuaiiot_alert_rules" IS '快数采 - 告警规则';
        COMMENT ON TABLE "apps_kuaiiot_alerts" IS '快数采 - 告警记录';
        COMMENT ON TABLE "apps_kuaiiot_edge_configs" IS '快数采 - 边缘 Agent 配置';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiiot_tag_definitions" DROP COLUMN IF EXISTS "fill_target";
        DROP TABLE IF EXISTS "apps_kuaiiot_edge_configs";
        DROP TABLE IF EXISTS "apps_kuaiiot_alerts";
        DROP TABLE IF EXISTS "apps_kuaiiot_alert_rules";
    """
