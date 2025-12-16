"""
创建审批流程表迁移

创建审批流程表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建审批流程表
        CREATE TABLE IF NOT EXISTS "root_approval_processes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "nodes" JSONB NOT NULL,
            "config" JSONB NOT NULL,
            "inngest_workflow_id" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_approval_processes" IS '审批流程表';
        
        -- 创建审批流程表索引
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_tenant_id" ON "root_approval_processes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_uuid" ON "root_approval_processes" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_code" ON "root_approval_processes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_is_active" ON "root_approval_processes" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_processes_created_at" ON "root_approval_processes" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_approval_processes_tenant_code" ON "root_approval_processes" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除审批流程表索引
        DROP INDEX IF EXISTS "uk_root_approval_processes_tenant_code";
        DROP INDEX IF EXISTS "idx_root_approval_processes_created_at";
        DROP INDEX IF EXISTS "idx_root_approval_processes_is_active";
        DROP INDEX IF EXISTS "idx_root_approval_processes_code";
        DROP INDEX IF EXISTS "idx_root_approval_processes_uuid";
        DROP INDEX IF EXISTS "idx_root_approval_processes_tenant_id";
        
        -- 删除审批流程表
        DROP TABLE IF EXISTS "root_approval_processes";
    """

