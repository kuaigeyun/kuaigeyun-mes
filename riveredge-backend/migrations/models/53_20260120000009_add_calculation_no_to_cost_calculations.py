"""
数据库迁移：添加 calculation_no 字段到成本核算记录表

为 apps_kuaizhizao_cost_calculations 表添加：
- calculation_no: 核算单号（VARCHAR(50)，允许为空）

注意：表中已有 code 字段，但模型使用 calculation_no，所以需要添加 calculation_no 字段。
如果存在 code 字段，将其值复制到 calculation_no。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 calculation_no 字段到成本核算记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 calculation_no 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                AND column_name = 'calculation_no'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_calculations 
                ADD COLUMN calculation_no VARCHAR(50);
                COMMENT ON COLUMN apps_kuaizhizao_cost_calculations.calculation_no IS '核算单号（组织内唯一）';
                
                -- 如果存在 code 字段，将其值复制到 calculation_no
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                    AND column_name = 'code'
                ) THEN
                    UPDATE apps_kuaizhizao_cost_calculations 
                    SET calculation_no = code 
                    WHERE calculation_no IS NULL AND code IS NOT NULL;
                END IF;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 calculation_no 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 calculation_no 字段
        ALTER TABLE apps_kuaizhizao_cost_calculations 
        DROP COLUMN IF EXISTS calculation_no;
    """
