"""
数据库迁移：添加工艺路线子工艺路线支持字段

为 apps_master_data_process_routes 表添加子工艺路线支持字段：
- parent_route_id: 父工艺路线ID（外键，如果此工艺路线是子工艺路线）
- parent_operation_uuid: 父工序UUID（此子工艺路线所属的父工序）
- level: 嵌套层级（0为主工艺路线，1-3为子工艺路线）

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加工艺路线子工艺路线支持字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加父工艺路线ID字段（外键）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'parent_route_id'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN parent_route_id INTEGER;
                COMMENT ON COLUMN apps_master_data_process_routes.parent_route_id IS '父工艺路线ID（如果此工艺路线是子工艺路线，则指向父工艺路线）';
            END IF;
        END $$;
        
        -- 添加父工序UUID字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'parent_operation_uuid'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN parent_operation_uuid VARCHAR(100);
                COMMENT ON COLUMN apps_master_data_process_routes.parent_operation_uuid IS '父工序UUID（此子工艺路线所属的父工序）';
            END IF;
        END $$;
        
        -- 添加嵌套层级字段（默认值：0）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'level'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN level INTEGER DEFAULT 0 NOT NULL;
                COMMENT ON COLUMN apps_master_data_process_routes.level IS '嵌套层级（0为主工艺路线，1为第一层子工艺路线，最多3层）';
            END IF;
        END $$;
        
        -- 添加外键约束
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_process_routes_parent_route'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD CONSTRAINT fk_process_routes_parent_route 
                FOREIGN KEY (parent_route_id) 
                REFERENCES apps_master_data_process_routes(id) 
                ON DELETE SET NULL;
            END IF;
        END $$;
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS idx_process_routes_parent_route_id 
        ON apps_master_data_process_routes(parent_route_id);
        
        CREATE INDEX IF NOT EXISTS idx_process_routes_parent_operation_uuid 
        ON apps_master_data_process_routes(parent_operation_uuid);
        
        CREATE INDEX IF NOT EXISTS idx_process_routes_level 
        ON apps_master_data_process_routes(level);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除工艺路线子工艺路线支持字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS idx_process_routes_level;
        DROP INDEX IF EXISTS idx_process_routes_parent_operation_uuid;
        DROP INDEX IF EXISTS idx_process_routes_parent_route_id;
        
        -- 删除外键约束
        ALTER TABLE apps_master_data_process_routes 
        DROP CONSTRAINT IF EXISTS fk_process_routes_parent_route;
        
        -- 删除嵌套层级字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS level;
        
        -- 删除父工序UUID字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS parent_operation_uuid;
        
        -- 删除父工艺路线ID字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS parent_route_id;
    """
