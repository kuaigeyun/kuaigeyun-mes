from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_file_preview_markups" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "file_uuid" VARCHAR(36) NOT NULL,
            "scope" VARCHAR(32) NOT NULL DEFAULT 'default',
            "payload" JSONB NOT NULL,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uid_core_file_preview_markups_tenant_file_scope"
                UNIQUE ("tenant_id", "file_uuid", "scope")
        );
        CREATE INDEX IF NOT EXISTS "idx_core_file_preview_markups_tenant"
            ON "core_file_preview_markups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_file_preview_markups_file"
            ON "core_file_preview_markups" ("file_uuid");
        COMMENT ON TABLE "core_file_preview_markups" IS '文件预览批注（不修改源文件）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_file_preview_markups";
    """
