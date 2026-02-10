"""
数据库迁移：添加工艺路线版本管理字段

为 apps_master_data_process_routes 表添加版本管理字段：
- version: 版本号（如：v1.0、v1.1）
- version_description: 版本说明
- base_version: 基于版本（从哪个版本创建）
- effective_date: 生效日期

同时更新唯一约束：从 (tenant_id, code) 改为 (tenant_id, code, version)

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加工艺路线版本管理字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加版本号字段（默认值：1.0）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'version'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN version VARCHAR(20) DEFAULT '1.0' NOT NULL;
                COMMENT ON COLUMN apps_master_data_process_routes.version IS '版本号（如：v1.0、v1.1）';
            END IF;
        END $$;
        
        -- 添加版本说明字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'version_description'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN version_description TEXT;
                COMMENT ON COLUMN apps_master_data_process_routes.version_description IS '版本说明';
            END IF;
        END $$;
        
        -- 添加基于版本字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'base_version'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN base_version VARCHAR(20);
                COMMENT ON COLUMN apps_master_data_process_routes.base_version IS '基于版本（从哪个版本创建）';
            END IF;
        END $$;
        
        -- 添加生效日期字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_master_data_process_routes' 
                AND column_name = 'effective_date'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD COLUMN effective_date TIMESTAMP;
                COMMENT ON COLUMN apps_master_data_process_routes.effective_date IS '生效日期';
            END IF;
        END $$;
        
        -- 删除旧的唯一约束 (tenant_id, code)
        ALTER TABLE apps_master_data_process_routes 
        DROP CONSTRAINT IF EXISTS apps_master_data_process_routes_tenant_id_code_key;
        
        -- 添加新的唯一约束 (tenant_id, code, version)
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'apps_master_data_process_routes_tenant_id_code_version_key'
            ) THEN
                ALTER TABLE apps_master_data_process_routes 
                ADD CONSTRAINT apps_master_data_process_routes_tenant_id_code_version_key 
                UNIQUE (tenant_id, code, version);
            END IF;
        END $$;
        
        -- 添加版本索引
        CREATE INDEX IF NOT EXISTS idx_process_routes_version 
        ON apps_master_data_process_routes(version);
        
        -- 添加编码+版本复合索引
        CREATE INDEX IF NOT EXISTS idx_process_routes_code_version 
        ON apps_master_data_process_routes(code, version);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除工艺路线版本管理字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS idx_process_routes_code_version;
        DROP INDEX IF EXISTS idx_process_routes_version;
        
        -- 删除新的唯一约束
        ALTER TABLE apps_master_data_process_routes 
        DROP CONSTRAINT IF EXISTS apps_master_data_process_routes_tenant_id_code_version_key;
        
        -- 恢复旧的唯一约束 (tenant_id, code)
        ALTER TABLE apps_master_data_process_routes 
        ADD CONSTRAINT apps_master_data_process_routes_tenant_id_code_key 
        UNIQUE (tenant_id, code);
        
        -- 删除生效日期字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS effective_date;
        
        -- 删除基于版本字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS base_version;
        
        -- 删除版本说明字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS version_description;
        
        -- 删除版本号字段
        ALTER TABLE apps_master_data_process_routes 
        DROP COLUMN IF EXISTS version;
    """
