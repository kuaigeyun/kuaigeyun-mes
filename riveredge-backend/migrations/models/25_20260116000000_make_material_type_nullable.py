"""
数据库迁移：将物料类型字段改为可空

将 apps_master_data_materials 表的 material_type 字段改为可空（NULL）。

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：将 material_type 字段改为可空
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        ALTER TABLE apps_master_data_materials 
        ALTER COLUMN material_type DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：将 material_type 字段改回非空（使用默认值 'RAW'）
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 先将 NULL 值更新为默认值
        UPDATE apps_master_data_materials 
        SET material_type = 'RAW' 
        WHERE material_type IS NULL;
        
        -- 然后将字段改回非空
        ALTER TABLE apps_master_data_materials 
        ALTER COLUMN material_type SET NOT NULL;
    """
