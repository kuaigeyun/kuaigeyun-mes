from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_field_name_aliases" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "source_name" VARCHAR(120) NOT NULL,
            "canonical_name" VARCHAR(120) NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_field_name_alias_tenant_source"
                UNIQUE ("tenant_id", "source_name")
        );

        CREATE INDEX IF NOT EXISTS "idx_core_field_name_alias_tenant_source"
            ON "core_field_name_aliases" ("tenant_id", "source_name");
        CREATE INDEX IF NOT EXISTS "idx_core_field_name_alias_tenant_canonical"
            ON "core_field_name_aliases" ("tenant_id", "canonical_name");
        CREATE INDEX IF NOT EXISTS "idx_core_field_name_alias_tenant_active"
            ON "core_field_name_aliases" ("tenant_id", "is_active");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_field_name_aliases";
    """
