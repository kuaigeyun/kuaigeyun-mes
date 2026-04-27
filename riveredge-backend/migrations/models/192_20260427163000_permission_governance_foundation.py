from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_permissions"
        ADD COLUMN IF NOT EXISTS "is_managed" BOOL NOT NULL DEFAULT TRUE;

        ALTER TABLE "core_permissions"
        ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(20);

        ALTER TABLE "core_permissions"
        ADD COLUMN IF NOT EXISTS "source_app" VARCHAR(50);

        ALTER TABLE "core_permissions"
        ADD COLUMN IF NOT EXISTS "source_path" VARCHAR(255);

        ALTER TABLE "core_permissions"
        ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMPTZ;

        CREATE INDEX IF NOT EXISTS "idx_core_permissions_tenant_deprecated_at"
            ON "core_permissions" ("tenant_id", "deprecated_at");

        CREATE INDEX IF NOT EXISTS "idx_core_permissions_tenant_source_type"
            ON "core_permissions" ("tenant_id", "source_type");

        CREATE TABLE IF NOT EXISTS "core_permission_aliases" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "old_code" VARCHAR(100) NOT NULL,
            "canonical_code" VARCHAR(100) NOT NULL,
            "reason" VARCHAR(50) NOT NULL DEFAULT 'normalized',
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_permission_aliases_tenant_old" UNIQUE ("tenant_id", "old_code")
        );

        CREATE INDEX IF NOT EXISTS "idx_core_permission_aliases_tenant_old"
            ON "core_permission_aliases" ("tenant_id", "old_code");
        CREATE INDEX IF NOT EXISTS "idx_core_permission_aliases_tenant_canonical"
            ON "core_permission_aliases" ("tenant_id", "canonical_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_permission_aliases";
        DROP INDEX IF EXISTS "idx_core_permissions_tenant_source_type";
        DROP INDEX IF EXISTS "idx_core_permissions_tenant_deprecated_at";
        ALTER TABLE "core_permissions" DROP COLUMN IF EXISTS "deprecated_at";
        ALTER TABLE "core_permissions" DROP COLUMN IF EXISTS "source_path";
        ALTER TABLE "core_permissions" DROP COLUMN IF EXISTS "source_app";
        ALTER TABLE "core_permissions" DROP COLUMN IF EXISTS "source_type";
        ALTER TABLE "core_permissions" DROP COLUMN IF EXISTS "is_managed";
    """
