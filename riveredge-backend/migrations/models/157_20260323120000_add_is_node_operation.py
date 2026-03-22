"""
添加工序「节点工序」标记（允许跳转时仍不可跳过）

Author: AI Assistant
Date: 2026-03-23
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_operations" ADD COLUMN IF NOT EXISTS "is_node_operation" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_operations"."is_node_operation" IS '是否节点工序（允许跳转时前序节点仍不可跳过）';

        ALTER TABLE "apps_kuaizhizao_work_order_operations" ADD COLUMN IF NOT EXISTS "is_node_operation" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."is_node_operation" IS '是否节点工序（允许跳转时前序节点仍不可跳过）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_operations" DROP COLUMN IF EXISTS "is_node_operation";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "is_node_operation";
    """
