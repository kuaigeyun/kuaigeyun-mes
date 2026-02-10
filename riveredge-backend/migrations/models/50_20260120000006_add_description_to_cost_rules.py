"""
数据库迁移：添加 description 字段到成本核算规则表

为 apps_kuaizhizao_cost_rules 表添加：
- description: 描述（TEXT，允许为空）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 description 字段到成本核算规则表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 description 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'description'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN description TEXT;
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.description IS '描述';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 description 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 description 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS description;
    """
