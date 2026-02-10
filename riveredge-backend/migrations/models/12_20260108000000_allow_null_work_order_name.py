"""
迁移：允许工单名称字段为 NULL

修改 apps_kuaizhizao_work_orders 表的 name 字段，允许为 NULL。

Author: Auto (AI Assistant)
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级数据库：允许工单名称字段为 NULL
    """
    return """
        -- 修改工单表的 name 字段，允许为 NULL
        ALTER TABLE apps_kuaizhizao_work_orders 
        ALTER COLUMN name DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级数据库：恢复工单名称字段为 NOT NULL
    """
    return """
        -- 恢复工单表的 name 字段为 NOT NULL
        -- 注意：如果表中已有 NULL 值，需要先更新这些值
        ALTER TABLE apps_kuaizhizao_work_orders 
        ALTER COLUMN name SET NOT NULL;
    """
