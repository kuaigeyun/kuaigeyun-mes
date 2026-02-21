"""
创建权限控制扩展表（RBAC+ABAC）

包含：
1. core_access_policies
2. core_policy_bindings
3. core_permission_versions
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_access_policies" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "name" VARCHAR(120) NOT NULL,
            "effect" VARCHAR(10) NOT NULL DEFAULT 'allow',
            "priority" INT NOT NULL DEFAULT 100,
            "target_resource" VARCHAR(100) NOT NULL,
            "target_action" VARCHAR(50) NOT NULL,
            "condition_expr" JSONB,
            "enabled" BOOL NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_access_policies_tenant_name"
            ON "core_access_policies" ("tenant_id", "name");
        CREATE INDEX IF NOT EXISTS "idx_core_access_policies_tenant_enabled"
            ON "core_access_policies" ("tenant_id", "enabled");
        CREATE INDEX IF NOT EXISTS "idx_core_access_policies_target"
            ON "core_access_policies" ("tenant_id", "target_resource", "target_action");
        CREATE INDEX IF NOT EXISTS "idx_core_access_policies_priority"
            ON "core_access_policies" ("tenant_id", "priority");

        CREATE TABLE IF NOT EXISTS "core_policy_bindings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "policy_id" INT NOT NULL,
            "subject_type" VARCHAR(20) NOT NULL,
            "subject_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "fk_core_policy_bindings_policy_id"
                FOREIGN KEY ("policy_id") REFERENCES "core_access_policies" ("id")
                ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_policy_bindings_unique"
            ON "core_policy_bindings" ("policy_id", "subject_type", "subject_id");
        CREATE INDEX IF NOT EXISTS "idx_core_policy_bindings_policy_id"
            ON "core_policy_bindings" ("policy_id");
        CREATE INDEX IF NOT EXISTS "idx_core_policy_bindings_subject"
            ON "core_policy_bindings" ("subject_type", "subject_id");

        CREATE TABLE IF NOT EXISTS "core_permission_versions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tenant_id" INT NOT NULL,
            "user_id" INT,
            "version" INT NOT NULL DEFAULT 1,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_permission_versions_tenant_user"
            ON "core_permission_versions" ("tenant_id", "user_id");
        CREATE INDEX IF NOT EXISTS "idx_core_permission_versions_tenant"
            ON "core_permission_versions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_permission_versions_tenant_user"
            ON "core_permission_versions" ("tenant_id", "user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_policy_bindings" CASCADE;
        DROP TABLE IF EXISTS "core_access_policies" CASCADE;
        DROP TABLE IF EXISTS "core_permission_versions" CASCADE;
    """
