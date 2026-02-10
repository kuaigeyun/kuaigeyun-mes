"""
数据库迁移：添加SOP参数字段到报工记录表

为 apps_kuaizhizao_reporting_records 表添加：
- sop_parameters: SOP参数数据（JSONB格式，存储报工时收集的SOP参数）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加SOP参数字段到报工记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加SOP参数字段（JSONB格式，允许为空）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_reporting_records' 
                AND column_name = 'sop_parameters'
            ) THEN
                ALTER TABLE apps_kuaizhizao_reporting_records 
                ADD COLUMN sop_parameters JSONB;
                COMMENT ON COLUMN apps_kuaizhizao_reporting_records.sop_parameters IS 'SOP参数数据（JSON格式，存储报工时收集的SOP参数）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除SOP参数字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除SOP参数字段
        ALTER TABLE apps_kuaizhizao_reporting_records 
        DROP COLUMN IF EXISTS sop_parameters;
    """
