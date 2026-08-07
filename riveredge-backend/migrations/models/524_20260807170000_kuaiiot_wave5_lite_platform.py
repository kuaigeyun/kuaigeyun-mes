"""
快数采 Wave 5：产品物模型、设备 product_id、告警 rule_type
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_products" (
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
            "description" TEXT,
            "tags" JSONB NOT NULL DEFAULT '[]',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_products_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_products_tenant_name"
            ON "apps_kuaiiot_products" ("tenant_id", "name");

        ALTER TABLE "apps_kuaiiot_devices"
            ADD COLUMN IF NOT EXISTS "product_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_devices_tenant_product"
            ON "apps_kuaiiot_devices" ("tenant_id", "product_id");

        ALTER TABLE "apps_kuaiiot_alert_rules"
            ADD COLUMN IF NOT EXISTS "rule_type" VARCHAR(20) NOT NULL DEFAULT 'threshold';
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_alert_rules_tenant_rule_type"
            ON "apps_kuaiiot_alert_rules" ("tenant_id", "rule_type");

        COMMENT ON TABLE "apps_kuaiiot_products" IS '快数采 - 产品物模型';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaiiot_alert_rules_tenant_rule_type";
        ALTER TABLE "apps_kuaiiot_alert_rules" DROP COLUMN IF EXISTS "rule_type";

        DROP INDEX IF EXISTS "idx_apps_kuaiiot_devices_tenant_product";
        ALTER TABLE "apps_kuaiiot_devices" DROP COLUMN IF EXISTS "product_id";

        DROP TABLE IF EXISTS "apps_kuaiiot_products";
    """
