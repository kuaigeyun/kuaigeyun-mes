"""
创建审批实例表迁移

创建审批实例表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建审批实例表
        CREATE TABLE IF NOT EXISTS "root_approval_instances" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "process_id" INT NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "content" TEXT,
            "data" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "current_node" VARCHAR(100),
            "current_approver_id" INT,
            "inngest_run_id" VARCHAR(100),
            "submitter_id" INT NOT NULL,
            "submitted_at" TIMESTAMPTZ NOT NULL,
            "completed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            FOREIGN KEY ("process_id") REFERENCES "root_approval_processes" ("id") ON DELETE RESTRICT
        );
COMMENT ON TABLE "root_approval_instances" IS '审批实例表';
        
        -- 创建审批实例表索引
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_tenant_id" ON "root_approval_instances" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_uuid" ON "root_approval_instances" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_process_id" ON "root_approval_instances" ("process_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_status" ON "root_approval_instances" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_current_approver_id" ON "root_approval_instances" ("current_approver_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_submitter_id" ON "root_approval_instances" ("submitter_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_inngest_run_id" ON "root_approval_instances" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_root_approval_instances_created_at" ON "root_approval_instances" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除审批实例表索引
        DROP INDEX IF EXISTS "idx_root_approval_instances_created_at";
        DROP INDEX IF EXISTS "idx_root_approval_instances_inngest_run_id";
        DROP INDEX IF EXISTS "idx_root_approval_instances_submitter_id";
        DROP INDEX IF EXISTS "idx_root_approval_instances_current_approver_id";
        DROP INDEX IF EXISTS "idx_root_approval_instances_status";
        DROP INDEX IF EXISTS "idx_root_approval_instances_process_id";
        DROP INDEX IF EXISTS "idx_root_approval_instances_uuid";
        DROP INDEX IF EXISTS "idx_root_approval_instances_tenant_id";
        
        -- 删除审批实例表
        DROP TABLE IF EXISTS "root_approval_instances";
    """

