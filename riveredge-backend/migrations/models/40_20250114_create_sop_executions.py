"""
创建 SOP 执行实例表

创建 seed_master_data_sop_executions 表，用于存储 SOP 执行实例。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建 SOP 执行实例表
        CREATE TABLE IF NOT EXISTS "seed_master_data_sop_executions" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "sop_id" INTEGER NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "current_node_id" VARCHAR(100),
            "node_data" JSONB,
            "inngest_run_id" VARCHAR(100),
            "executor_id" INTEGER NOT NULL,
            "started_at" TIMESTAMPTZ NOT NULL,
            "completed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_seed_master_data_sop_executions_sop_id" FOREIGN KEY ("sop_id") REFERENCES "seed_master_data_sop" ("id") ON DELETE CASCADE
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_tenant_id" ON "seed_master_data_sop_executions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_uuid" ON "seed_master_data_sop_executions" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_sop_id" ON "seed_master_data_sop_executions" ("sop_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_status" ON "seed_master_data_sop_executions" ("status");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_executor_id" ON "seed_master_data_sop_executions" ("executor_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_current_node_id" ON "seed_master_data_sop_executions" ("current_node_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_inngest_run_id" ON "seed_master_data_sop_executions" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_created_at" ON "seed_master_data_sop_executions" ("created_at");
        
        -- 创建复合索引
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_tenant_status" ON "seed_master_data_sop_executions" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_tenant_executor_status" ON "seed_master_data_sop_executions" ("tenant_id", "executor_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_executions_tenant_created_at" ON "seed_master_data_sop_executions" ("tenant_id", "created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除表
        DROP TABLE IF EXISTS "seed_master_data_sop_executions";
    """

