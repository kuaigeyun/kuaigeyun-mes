"""
删除旧审批流程表（已统一至 core ApprovalProcess/Instance/Task）

删除：apps_kuaizhizao_approval_flows、approval_flow_steps、approval_records

Author: RiverEdge Team
Date: 2026-02-22
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_approval_records" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_approval_flow_steps" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_approval_flows" CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 降级时需重新创建表结构，此处仅作占位
        -- 实际回滚需从历史迁移恢复
        SELECT 1;
    """
