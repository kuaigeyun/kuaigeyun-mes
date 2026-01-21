"""
数据库迁移：添加 manufacturing_cost 字段到成本核算记录表

为 apps_kuaizhizao_cost_calculations 表添加：
- manufacturing_cost: 制造费用（DECIMAL(12,2)，默认0）

注意：表中已有 overhead_cost 字段，但模型使用 manufacturing_cost，所以需要添加 manufacturing_cost 字段。
如果存在 overhead_cost 字段，将其值复制到 manufacturing_cost。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 manufacturing_cost 字段到成本核算记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 manufacturing_cost 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                AND column_name = 'manufacturing_cost'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_calculations 
                ADD COLUMN manufacturing_cost NUMERIC(12,2) DEFAULT 0;
                COMMENT ON COLUMN apps_kuaizhizao_cost_calculations.manufacturing_cost IS '制造费用';
                
                -- 如果存在 overhead_cost 字段，将其值复制到 manufacturing_cost
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                    AND column_name = 'overhead_cost'
                ) THEN
                    UPDATE apps_kuaizhizao_cost_calculations 
                    SET manufacturing_cost = overhead_cost 
                    WHERE manufacturing_cost = 0 AND overhead_cost IS NOT NULL;
                END IF;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 manufacturing_cost 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 manufacturing_cost 字段
        ALTER TABLE apps_kuaizhizao_cost_calculations 
        DROP COLUMN IF EXISTS manufacturing_cost;
    """
