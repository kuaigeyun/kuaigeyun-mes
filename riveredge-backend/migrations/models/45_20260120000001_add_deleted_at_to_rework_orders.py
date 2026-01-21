"""
数据库迁移：添加软删除字段到返工单表

为 apps_kuaizhizao_rework_orders 表添加：
- deleted_at: 删除时间（TIMESTAMPTZ，允许为空，用于软删除）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加软删除字段到返工单表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加软删除字段（TIMESTAMPTZ格式，允许为空）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_rework_orders' 
                AND column_name = 'deleted_at'
            ) THEN
                ALTER TABLE apps_kuaizhizao_rework_orders 
                ADD COLUMN deleted_at TIMESTAMPTZ;
                COMMENT ON COLUMN apps_kuaizhizao_rework_orders.deleted_at IS '删除时间（软删除）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除软删除字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除软删除字段
        ALTER TABLE apps_kuaizhizao_rework_orders 
        DROP COLUMN IF EXISTS deleted_at;
    """
