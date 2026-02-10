"""
数据库迁移：添加 remark 字段到成本核算记录表

为 apps_kuaizhizao_cost_calculations 表添加：
- remark: 备注（TEXT，允许为空）

注意：表中已有 remarks 字段，但模型使用 remark，所以需要添加 remark 字段。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 remark 字段到成本核算记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 remark 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                AND column_name = 'remark'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_calculations 
                ADD COLUMN remark TEXT;
                COMMENT ON COLUMN apps_kuaizhizao_cost_calculations.remark IS '备注';
                
                -- 如果存在 remarks 字段，将其值复制到 remark
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
                    AND column_name = 'remarks'
                ) THEN
                    UPDATE apps_kuaizhizao_cost_calculations 
                    SET remark = remarks 
                    WHERE remark IS NULL AND remarks IS NOT NULL;
                END IF;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 remark 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 remark 字段
        ALTER TABLE apps_kuaizhizao_cost_calculations 
        DROP COLUMN IF EXISTS remark;
    """
