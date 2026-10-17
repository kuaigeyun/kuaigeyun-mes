"""快视觉 P3：样本库、模型制品、保留策略与运维告警字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaivision_recipe_versions"
            ADD COLUMN IF NOT EXISTS "model_artifact_id" INT;
        ALTER TABLE "apps_kuaivision_recipe_versions"
            ADD COLUMN IF NOT EXISTS "require_model" BOOL NOT NULL DEFAULT FALSE;

        ALTER TABLE "apps_kuaivision_agents"
            ADD COLUMN IF NOT EXISTS "last_ops_alert_at" TIMESTAMPTZ;

        ALTER TABLE "apps_kuaivision_settings"
            ADD COLUMN IF NOT EXISTS "image_retention_days" INT NOT NULL DEFAULT 90;
        ALTER TABLE "apps_kuaivision_settings"
            ADD COLUMN IF NOT EXISTS "event_retention_days" INT NOT NULL DEFAULT 180;
        ALTER TABLE "apps_kuaivision_settings"
            ADD COLUMN IF NOT EXISTS "buffer_alert_threshold" INT NOT NULL DEFAULT 50;
        ALTER TABLE "apps_kuaivision_settings"
            ADD COLUMN IF NOT EXISTS "disk_alert_mb" INT NOT NULL DEFAULT 1024;

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_model_artifacts" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "framework" VARCHAR(30) NOT NULL DEFAULT 'onnx',
            "object_key" VARCHAR(500) NOT NULL,
            "checksum" VARCHAR(128) NOT NULL,
            "input_width" INT,
            "input_height" INT,
            "label_map" JSONB,
            "is_enabled" BOOL NOT NULL DEFAULT TRUE,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            CONSTRAINT "uid_kuaivision_model_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_model_enabled" ON "apps_kuaivision_model_artifacts" ("tenant_id", "is_enabled");
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_model_checksum" ON "apps_kuaivision_model_artifacts" ("tenant_id", "checksum");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_sample_sets" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "recipe_code" VARCHAR(50),
            "is_enabled" BOOL NOT NULL DEFAULT TRUE,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            CONSTRAINT "uid_kuaivision_sample_set_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_sample_set_recipe" ON "apps_kuaivision_sample_sets" ("tenant_id", "recipe_code");
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_sample_set_enabled" ON "apps_kuaivision_sample_sets" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_sample_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "sample_set_id" INT NOT NULL,
            "label" VARCHAR(30) NOT NULL,
            "object_key" VARCHAR(500) NOT NULL,
            "source_event_id" INT,
            "source_event_uuid" VARCHAR(36),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_sample_item_set" ON "apps_kuaivision_sample_items" ("tenant_id", "sample_set_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_sample_item_label" ON "apps_kuaivision_sample_items" ("tenant_id", "label");
        CREATE INDEX IF NOT EXISTS "idx_kuaivision_sample_item_event" ON "apps_kuaivision_sample_items" ("tenant_id", "source_event_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaivision_sample_items";
        DROP TABLE IF EXISTS "apps_kuaivision_sample_sets";
        DROP TABLE IF EXISTS "apps_kuaivision_model_artifacts";
        ALTER TABLE "apps_kuaivision_settings" DROP COLUMN IF EXISTS "disk_alert_mb";
        ALTER TABLE "apps_kuaivision_settings" DROP COLUMN IF EXISTS "buffer_alert_threshold";
        ALTER TABLE "apps_kuaivision_settings" DROP COLUMN IF EXISTS "event_retention_days";
        ALTER TABLE "apps_kuaivision_settings" DROP COLUMN IF EXISTS "image_retention_days";
        ALTER TABLE "apps_kuaivision_agents" DROP COLUMN IF EXISTS "last_ops_alert_at";
        ALTER TABLE "apps_kuaivision_recipe_versions" DROP COLUMN IF EXISTS "require_model";
        ALTER TABLE "apps_kuaivision_recipe_versions" DROP COLUMN IF EXISTS "model_artifact_id";
    """
