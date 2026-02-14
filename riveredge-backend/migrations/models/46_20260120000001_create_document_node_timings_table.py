"""
创建单据节点耗时记录表

创建 apps_kuaizhizao_document_node_timings 表，用于记录工单等单据在各节点的开始/结束时间。
迁移 47、48 会向此表添加 duration_hours、node_code 等字段。

Author: Auto (AI Assistant)
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建单据节点耗时记录表
    """
    return """
        -- 创建单据节点耗时记录表（迁移 47、48 会添加 duration_hours、node_code）
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_document_node_timings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "document_type" VARCHAR(50) NOT NULL,
            "document_id" INT NOT NULL,
            "document_code" VARCHAR(50) NOT NULL,
            "node_name" VARCHAR(100) NOT NULL,
            "node_code" VARCHAR(50),
            "start_time" TIMESTAMPTZ,
            "end_time" TIMESTAMPTZ,
            "duration_seconds" INT,
            "duration_hours" DECIMAL(10,2),
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_tenant_id" ON "apps_kuaizhizao_document_node_timings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_document_type" ON "apps_kuaizhizao_document_node_timings" ("document_type");
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_document_id" ON "apps_kuaizhizao_document_node_timings" ("document_id");
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_node_code" ON "apps_kuaizhizao_document_node_timings" ("node_code");
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_start_time" ON "apps_kuaizhizao_document_node_timings" ("start_time");
        CREATE INDEX IF NOT EXISTS "idx_document_node_timings_end_time" ON "apps_kuaizhizao_document_node_timings" ("end_time");
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_document_node_timings" IS '快格轻制造 - 单据节点耗时';
        COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."document_type" IS '单据类型（work_order/purchase_order等）';
        COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."document_id" IS '单据ID';
        COMMENT ON COLUMN "apps_kuaizhizao_document_node_timings"."node_code" IS '节点编码（如：created/released/reported）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除单据节点耗时记录表
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_document_node_timings" CASCADE;
    """
