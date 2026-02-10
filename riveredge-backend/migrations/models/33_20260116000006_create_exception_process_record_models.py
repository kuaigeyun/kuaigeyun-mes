"""
添加异常处理流程相关模型

根据功能点2.5.6：异常处理流程

包含：
1. apps_kuaizhizao_exception_process_records - 异常处理记录
2. apps_kuaizhizao_exception_process_histories - 异常处理历史记录

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加异常处理流程相关模型
    """
    return """
        -- ============================================
        -- 1. 创建异常处理记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_exception_process_records" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "exception_type" VARCHAR(50) NOT NULL,
            "exception_id" INT NOT NULL,
            "process_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "current_step" VARCHAR(50) NOT NULL DEFAULT 'detected',
            "assigned_to" INT,
            "assigned_to_name" VARCHAR(100),
            "assigned_at" TIMESTAMPTZ,
            "inngest_run_id" VARCHAR(100),
            "process_config" JSONB,
            "started_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_tenant_id" ON "apps_kuaizhizao_exception_process_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_exception_type" ON "apps_kuaizhizao_exception_process_records" ("exception_type");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_exception_id" ON "apps_kuaizhizao_exception_process_records" ("exception_id");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_process_status" ON "apps_kuaizhizao_exception_process_records" ("process_status");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_current_step" ON "apps_kuaizhizao_exception_process_records" ("current_step");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_assigned_to" ON "apps_kuaizhizao_exception_process_records" ("assigned_to");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_created_at" ON "apps_kuaizhizao_exception_process_records" ("created_at");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_records_uuid" ON "apps_kuaizhizao_exception_process_records" ("uuid");

        -- ============================================
        -- 2. 创建异常处理历史记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_exception_process_histories" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "process_record_id" INT NOT NULL,
            "action" VARCHAR(50) NOT NULL,
            "action_by" INT NOT NULL,
            "action_by_name" VARCHAR(100) NOT NULL,
            "action_at" TIMESTAMPTZ NOT NULL,
            "from_step" VARCHAR(50),
            "to_step" VARCHAR(50),
            "comment" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_tenant_id" ON "apps_kuaizhizao_exception_process_histories" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_process_record_id" ON "apps_kuaizhizao_exception_process_histories" ("process_record_id");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_action" ON "apps_kuaizhizao_exception_process_histories" ("action");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_action_by" ON "apps_kuaizhizao_exception_process_histories" ("action_by");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_action_at" ON "apps_kuaizhizao_exception_process_histories" ("action_at");
        CREATE INDEX IF NOT EXISTS "idx_exception_process_histories_uuid" ON "apps_kuaizhizao_exception_process_histories" ("uuid");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除异常处理流程相关模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_exception_process_histories_uuid";
        DROP INDEX IF EXISTS "idx_exception_process_histories_action_at";
        DROP INDEX IF EXISTS "idx_exception_process_histories_action_by";
        DROP INDEX IF EXISTS "idx_exception_process_histories_action";
        DROP INDEX IF EXISTS "idx_exception_process_histories_process_record_id";
        DROP INDEX IF EXISTS "idx_exception_process_histories_tenant_id";

        DROP INDEX IF EXISTS "idx_exception_process_records_uuid";
        DROP INDEX IF EXISTS "idx_exception_process_records_created_at";
        DROP INDEX IF EXISTS "idx_exception_process_records_assigned_to";
        DROP INDEX IF EXISTS "idx_exception_process_records_current_step";
        DROP INDEX IF EXISTS "idx_exception_process_records_process_status";
        DROP INDEX IF EXISTS "idx_exception_process_records_exception_id";
        DROP INDEX IF EXISTS "idx_exception_process_records_exception_type";
        DROP INDEX IF EXISTS "idx_exception_process_records_tenant_id";

        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_exception_process_histories";
        DROP TABLE IF EXISTS "apps_kuaizhizao_exception_process_records";
    """
