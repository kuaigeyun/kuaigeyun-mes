"""快视觉 P1：相机、工位绑定、方案版本、复核、配置。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaivision_cameras" (
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
            "sdk_type" VARCHAR(40) NOT NULL,
            "serial_no" VARCHAR(100),
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_cameras_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_cameras_enabled"
            ON "apps_kuaivision_cameras" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_station_binds" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "camera_id" INT NOT NULL,
            "station_code" VARCHAR(50) NOT NULL,
            "plant_code" VARCHAR(50),
            "workshop_code" VARCHAR(50),
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_binds_camera"
            ON "apps_kuaivision_station_binds" ("tenant_id", "camera_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_binds_station"
            ON "apps_kuaivision_station_binds" ("tenant_id", "station_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_recipes" (
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
            "recipe_type" VARCHAR(40) NOT NULL,
            "review_threshold" DECIMAL(8,4),
            "is_enabled" BOOL NOT NULL DEFAULT True,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_recipes_tenant_code" UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_recipes_type"
            ON "apps_kuaivision_recipes" ("tenant_id", "recipe_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_recipes_enabled"
            ON "apps_kuaivision_recipes" ("tenant_id", "is_enabled");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_recipe_versions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "recipe_id" INT NOT NULL,
            "version" VARCHAR(30) NOT NULL,
            "status" VARCHAR(20) NOT NULL,
            "params" JSONB,
            "published_at" TIMESTAMPTZ,
            "published_by" INT,
            "published_by_name" VARCHAR(100),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_recipe_ver" UNIQUE ("tenant_id", "recipe_id", "version")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_recipe_ver_status"
            ON "apps_kuaivision_recipe_versions" ("tenant_id", "recipe_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_review_tasks" (
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
            "status" VARCHAR(20) NOT NULL,
            "original_judgment" VARCHAR(20) NOT NULL,
            "reviewed_judgment" VARCHAR(20),
            "reason" TEXT,
            "reviewed_at" TIMESTAMPTZ,
            "reviewed_by" INT,
            "reviewed_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_reviews_status"
            ON "apps_kuaivision_review_tasks" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaivision_reviews_event"
            ON "apps_kuaivision_review_tasks" ("tenant_id", "event_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaivision_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "require_published_recipe" BOOL NOT NULL DEFAULT False,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaivision_settings_tenant" UNIQUE ("tenant_id")
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaivision_settings";
        DROP TABLE IF EXISTS "apps_kuaivision_review_tasks";
        DROP TABLE IF EXISTS "apps_kuaivision_recipe_versions";
        DROP TABLE IF EXISTS "apps_kuaivision_recipes";
        DROP TABLE IF EXISTS "apps_kuaivision_station_binds";
        DROP TABLE IF EXISTS "apps_kuaivision_cameras";
    """
