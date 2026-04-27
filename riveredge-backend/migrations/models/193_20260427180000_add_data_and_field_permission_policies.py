from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_data_permission_policies" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "role_uuid" VARCHAR(36) NOT NULL,
            "resource" VARCHAR(100) NOT NULL,
            "scope_type" VARCHAR(30) NOT NULL DEFAULT 'scope_self',
            "scope_payload" JSONB,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_data_perm_policy_tenant_role_resource"
                UNIQUE ("tenant_id", "role_uuid", "resource")
        );
        CREATE INDEX IF NOT EXISTS "idx_core_data_perm_policy_tenant_role"
            ON "core_data_permission_policies" ("tenant_id", "role_uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_data_perm_policy_tenant_resource"
            ON "core_data_permission_policies" ("tenant_id", "resource");
        CREATE INDEX IF NOT EXISTS "idx_core_data_perm_policy_tenant_scope"
            ON "core_data_permission_policies" ("tenant_id", "scope_type");

        CREATE TABLE IF NOT EXISTS "core_field_permission_policies" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "role_uuid" VARCHAR(36) NOT NULL,
            "resource" VARCHAR(100) NOT NULL,
            "field_name" VARCHAR(120) NOT NULL,
            "mask_level" VARCHAR(20) NOT NULL DEFAULT 'full',
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_field_perm_policy_tenant_role_resource_field"
                UNIQUE ("tenant_id", "role_uuid", "resource", "field_name")
        );
        CREATE INDEX IF NOT EXISTS "idx_core_field_perm_policy_tenant_role"
            ON "core_field_permission_policies" ("tenant_id", "role_uuid");
        CREATE INDEX IF NOT EXISTS "idx_core_field_perm_policy_tenant_resource"
            ON "core_field_permission_policies" ("tenant_id", "resource");
        CREATE INDEX IF NOT EXISTS "idx_core_field_perm_policy_tenant_level"
            ON "core_field_permission_policies" ("tenant_id", "mask_level");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_field_permission_policies";
        DROP TABLE IF EXISTS "core_data_permission_policies";
    """
