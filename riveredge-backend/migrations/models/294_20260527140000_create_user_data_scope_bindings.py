from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_user_data_scope_bindings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "user_id" INT NOT NULL,
            "dimension" VARCHAR(64) NOT NULL,
            "scope_code" VARCHAR(64) NOT NULL,
            "scope_name" VARCHAR(200),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_user_data_scope_binding"
                UNIQUE ("tenant_id", "user_id", "dimension", "scope_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_core_user_data_scope_binding_user_dim"
            ON "core_user_data_scope_bindings" ("tenant_id", "user_id", "dimension");
        CREATE INDEX IF NOT EXISTS "idx_core_user_data_scope_binding_dim_code"
            ON "core_user_data_scope_bindings" ("tenant_id", "dimension", "scope_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_user_data_scope_bindings";
    """
