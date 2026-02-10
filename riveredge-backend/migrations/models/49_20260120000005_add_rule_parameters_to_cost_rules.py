"""
数据库迁移：添加 rule_parameters 字段到成本核算规则表

为 apps_kuaizhizao_cost_rules 表添加：
- rule_parameters: 规则参数（JSONB，允许为空）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 rule_parameters 字段到成本核算规则表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 rule_parameters 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'rule_parameters'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN rule_parameters JSONB;
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.rule_parameters IS '规则参数（JSON格式）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 rule_parameters 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 rule_parameters 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS rule_parameters;
    """
