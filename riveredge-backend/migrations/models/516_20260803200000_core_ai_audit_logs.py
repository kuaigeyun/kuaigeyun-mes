from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_ai_audit_logs" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "user_id" INT,
            "route" VARCHAR(256) NOT NULL,
            "capability" VARCHAR(64),
            "model" VARCHAR(128),
            "latency_ms" INT,
            "prompt_tokens" INT,
            "completion_tokens" INT,
            "status_code" INT,
            "error_message" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_core_ai_audit_logs_tenant"
            ON "core_ai_audit_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_ai_audit_logs_user"
            ON "core_ai_audit_logs" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_core_ai_audit_logs_created"
            ON "core_ai_audit_logs" ("created_at");
        COMMENT ON TABLE "core_ai_audit_logs" IS 'RiverEdge AI Runtime 调用审计';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_ai_audit_logs";
    """
