"""
数据库迁移：添加审计字段到返工单表

为 apps_kuaizhizao_rework_orders 表添加：
- created_by: 创建人ID（INT，允许为空）
- created_by_name: 创建人姓名（VARCHAR(100)，允许为空）
- updated_by: 更新人ID（INT，允许为空）
- updated_by_name: 更新人姓名（VARCHAR(100)，允许为空）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加审计字段到返工单表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加创建人字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_rework_orders' 
                AND column_name = 'created_by'
            ) THEN
                ALTER TABLE apps_kuaizhizao_rework_orders 
                ADD COLUMN created_by INT;
                COMMENT ON COLUMN apps_kuaizhizao_rework_orders.created_by IS '创建人ID';
            END IF;
        END $$;
        
        -- 添加创建人姓名字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_rework_orders' 
                AND column_name = 'created_by_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_rework_orders 
                ADD COLUMN created_by_name VARCHAR(100);
                COMMENT ON COLUMN apps_kuaizhizao_rework_orders.created_by_name IS '创建人姓名';
            END IF;
        END $$;
        
        -- 添加更新人字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_rework_orders' 
                AND column_name = 'updated_by'
            ) THEN
                ALTER TABLE apps_kuaizhizao_rework_orders 
                ADD COLUMN updated_by INT;
                COMMENT ON COLUMN apps_kuaizhizao_rework_orders.updated_by IS '更新人ID';
            END IF;
        END $$;
        
        -- 添加更新人姓名字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_rework_orders' 
                AND column_name = 'updated_by_name'
            ) THEN
                ALTER TABLE apps_kuaizhizao_rework_orders 
                ADD COLUMN updated_by_name VARCHAR(100);
                COMMENT ON COLUMN apps_kuaizhizao_rework_orders.updated_by_name IS '更新人姓名';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除审计字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除更新人姓名字段
        ALTER TABLE apps_kuaizhizao_rework_orders 
        DROP COLUMN IF EXISTS updated_by_name;
        
        -- 删除更新人字段
        ALTER TABLE apps_kuaizhizao_rework_orders 
        DROP COLUMN IF EXISTS updated_by;
        
        -- 删除创建人姓名字段
        ALTER TABLE apps_kuaizhizao_rework_orders 
        DROP COLUMN IF EXISTS created_by_name;
        
        -- 删除创建人字段
        ALTER TABLE apps_kuaizhizao_rework_orders 
        DROP COLUMN IF EXISTS created_by;
    """
