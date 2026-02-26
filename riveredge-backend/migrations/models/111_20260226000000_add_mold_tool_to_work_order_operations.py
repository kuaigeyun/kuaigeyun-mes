"""
工单工序增加模具、工装派工字段

为工单工序表添加 assigned_mold_id、assigned_mold_name、assigned_tool_id、assigned_tool_name 字段，
支持派工时指定模具和工装。

Author: Plan Implementation
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_operations"
        ADD COLUMN IF NOT EXISTS "assigned_mold_id" INT NULL,
        ADD COLUMN IF NOT EXISTS "assigned_mold_name" VARCHAR(200) NULL,
        ADD COLUMN IF NOT EXISTS "assigned_tool_id" INT NULL,
        ADD COLUMN IF NOT EXISTS "assigned_tool_name" VARCHAR(200) NULL;
    """
