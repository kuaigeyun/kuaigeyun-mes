"""
数据库迁移：添加 duration_hours 字段到单据节点耗时记录表

为 apps_kuaizhizao_document_node_timings 表添加：
- duration_hours: 节点耗时（小时，排除非工作时间）（DECIMAL(10,2)，允许为空）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 duration_hours 字段到单据节点耗时记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 duration_hours 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_document_node_timings' 
                AND column_name = 'duration_hours'
            ) THEN
                ALTER TABLE apps_kuaizhizao_document_node_timings 
                ADD COLUMN duration_hours DECIMAL(10,2);
                COMMENT ON COLUMN apps_kuaizhizao_document_node_timings.duration_hours IS '节点耗时（小时，排除非工作时间）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 duration_hours 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 duration_hours 字段
        ALTER TABLE apps_kuaizhizao_document_node_timings 
        DROP COLUMN IF EXISTS duration_hours;
    """
