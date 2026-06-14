"""
审核单据绑定表 + 从 legacy ApprovalProcess 迁移开关。

legacy：ApprovalProcess.code = node_key 且 is_active 曾作为审核开关。
新模型：core_audit_document_bindings 独立管理开关与流程 FK。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_audit_document_bindings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "node_key" VARCHAR(50) NOT NULL,
            "is_enabled" BOOL NOT NULL DEFAULT FALSE,
            "process_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_audit_bind_process"
                FOREIGN KEY ("process_id") REFERENCES "core_approval_processes" ("id") ON DELETE SET NULL
        );
        COMMENT ON TABLE "core_audit_document_bindings" IS '审核单据绑定（开关 + 审批流程）';

        CREATE UNIQUE INDEX IF NOT EXISTS "uid_core_audit_document_bindings_tenant_id_node_key"
            ON "core_audit_document_bindings" ("tenant_id", "node_key")
            WHERE "deleted_at" IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_audit_bind_tenant_enabled"
            ON "core_audit_document_bindings" ("tenant_id", "is_enabled");

        INSERT INTO "core_audit_document_bindings"
            ("uuid", "tenant_id", "node_key", "is_enabled", "process_id", "created_at", "updated_at")
        SELECT
            gen_random_uuid()::text,
            p."tenant_id",
            p."code",
            p."is_active",
            p."id",
            NOW(),
            NOW()
        FROM "core_approval_processes" p
        WHERE p."deleted_at" IS NULL
          AND p."code" NOT IN ('personal_task')
          AND NOT EXISTS (
              SELECT 1 FROM "core_audit_document_bindings" b
              WHERE b."tenant_id" = p."tenant_id"
                AND b."node_key" = p."code"
                AND b."deleted_at" IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_audit_document_bindings";
    """
