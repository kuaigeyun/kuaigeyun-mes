"""
数据库迁移：添加缺失字段到成本核算规则表

为 apps_kuaizhizao_cost_rules 表添加：
- rule_type: 规则类型（VARCHAR(50)，NOT NULL）
- calculation_method: 计算方法（VARCHAR(50)，NOT NULL）
- calculation_formula: 计算公式（JSONB，允许为空）
- is_active: 是否启用（BOOLEAN，默认TRUE）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加缺失字段到成本核算规则表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 rule_type 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'rule_type'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN rule_type VARCHAR(50);
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.rule_type IS '规则类型（材料成本、人工成本、制造费用）';
            END IF;
        END $$;
        
        -- 添加 calculation_method 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'calculation_method'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN calculation_method VARCHAR(50);
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.calculation_method IS '计算方法（按数量、按工时、按比例、按固定值等）';
            END IF;
        END $$;
        
        -- 添加 calculation_formula 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'calculation_formula'
            ) THEN
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN calculation_formula JSONB;
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.calculation_formula IS '计算公式（JSON格式，存储计算公式配置）';
            END IF;
        END $$;
        
        -- 添加 is_active 字段（如果表中有 is_enabled，则将其值复制到 is_active，然后可以删除 is_enabled）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                AND column_name = 'is_active'
            ) THEN
                -- 如果存在 is_enabled 字段，先添加 is_active 字段
                ALTER TABLE apps_kuaizhizao_cost_rules 
                ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
                COMMENT ON COLUMN apps_kuaizhizao_cost_rules.is_active IS '是否启用';
                
                -- 如果存在 is_enabled 字段，将值复制到 is_active
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'apps_kuaizhizao_cost_rules' 
                    AND column_name = 'is_enabled'
                ) THEN
                    UPDATE apps_kuaizhizao_cost_rules 
                    SET is_active = is_enabled 
                    WHERE is_active IS NULL;
                END IF;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除添加的字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除 is_active 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS is_active;
        
        -- 删除 calculation_formula 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS calculation_formula;
        
        -- 删除 calculation_method 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS calculation_method;
        
        -- 删除 rule_type 字段
        ALTER TABLE apps_kuaizhizao_cost_rules 
        DROP COLUMN IF EXISTS rule_type;
    """
