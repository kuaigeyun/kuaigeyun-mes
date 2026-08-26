"""
core_resource_categories 及 apis/datasets 分类外键。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_resource_categories" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "resource_type" VARCHAR(20) NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_resource_categories_tenant_id_resource_type_code"
                UNIQUE ("tenant_id", "resource_type", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_core_resource_categories_tenant_id_resource_type"
            ON "core_resource_categories" ("tenant_id", "resource_type");
        CREATE INDEX IF NOT EXISTS "idx_core_resource_categories_uuid"
            ON "core_resource_categories" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_resource_categories_created_at"
            ON "core_resource_categories" ("created_at");

        ALTER TABLE "core_apis"
            ADD COLUMN IF NOT EXISTS "category_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_core_apis_category_id"
            ON "core_apis" ("category_id");
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_core_apis_category_id'
            ) THEN
                ALTER TABLE "core_apis"
                    ADD CONSTRAINT "fk_core_apis_category_id"
                    FOREIGN KEY ("category_id")
                    REFERENCES "core_resource_categories" ("id")
                    ON DELETE SET NULL;
            END IF;
        END $$;

        ALTER TABLE "core_datasets"
            ADD COLUMN IF NOT EXISTS "category_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_category_id"
            ON "core_datasets" ("category_id");
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_core_datasets_category_id'
            ) THEN
                ALTER TABLE "core_datasets"
                    ADD CONSTRAINT "fk_core_datasets_category_id"
                    FOREIGN KEY ("category_id")
                    REFERENCES "core_resource_categories" ("id")
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_datasets" DROP CONSTRAINT IF EXISTS "fk_core_datasets_category_id";
        DROP INDEX IF EXISTS "idx_core_datasets_category_id";
        ALTER TABLE "core_datasets" DROP COLUMN IF EXISTS "category_id";

        ALTER TABLE "core_apis" DROP CONSTRAINT IF EXISTS "fk_core_apis_category_id";
        DROP INDEX IF EXISTS "idx_core_apis_category_id";
        ALTER TABLE "core_apis" DROP COLUMN IF EXISTS "category_id";

        DROP TABLE IF EXISTS "core_resource_categories";
    """
