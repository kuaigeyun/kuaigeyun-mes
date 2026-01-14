"""
数据库迁移：添加工序报工类型和跳转规则字段

为 apps_master_data_operations 表添加：
- reporting_type: 报工类型（quantity:按数量报工, status:按状态报工）
- allow_jump: 是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加工序报工类型和跳转规则字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加报工类型字段（默认值：quantity）
        ALTER TABLE apps_master_data_operations 
        ADD COLUMN reporting_type VARCHAR(20) DEFAULT 'quantity' NOT NULL;
        
        -- 添加是否允许跳转字段（默认值：false）
        ALTER TABLE apps_master_data_operations 
        ADD COLUMN allow_jump BOOLEAN DEFAULT false NOT NULL;
        
        -- 添加注释
        COMMENT ON COLUMN apps_master_data_operations.reporting_type IS '报工类型（quantity:按数量报工, status:按状态报工）';
        COMMENT ON COLUMN apps_master_data_operations.allow_jump IS '是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除工序报工类型和跳转规则字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除是否允许跳转字段
        ALTER TABLE apps_master_data_operations 
        DROP COLUMN IF EXISTS allow_jump;
        
        -- 删除报工类型字段
        ALTER TABLE apps_master_data_operations 
        DROP COLUMN IF EXISTS reporting_type;
    """
