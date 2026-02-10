"""
数据库迁移：添加 calculation_status 字段到成本核算记录表

为 apps_kuaizhizao_cost_calculations 表添加：
- calculation_status: 核算状态（VARCHAR(50)，默认'草稿'）

注意：表中已有 status 字段，但模型使用 calculation_status，所以需要添加 calculation_status 字段。
如果存在 status 字段，将其值复制到 calculation_status。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 calculation_status 字段到成本核算记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 calculation_status 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                AND column_name = 'calculation_status'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_calculations 
                ADD COLUMN calculation_status VARCHAR(50) DEFAULT '草稿';
                COMMENT ON COLUMN apps_kuaizhizao_cost_calculations.calculation_status IS '核算状态（草稿、已核算、已审核）';
                
                -- 如果存在 status 字段，将其值复制到 calculation_status
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                    AND column_name = 'status'
                ) THEN
                    UPDATE apps_kuaizhizao_cost_calculations 
                    SET calculation_status = status 
                    WHERE calculation_status = '草稿' AND status IS NOT NULL;
                END IF;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 calculation_status 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 calculation_status 字段
        ALTER TABLE apps_kuaizhizao_cost_calculations 
        DROP COLUMN IF EXISTS calculation_status;
    """
