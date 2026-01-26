"""
将工序表的 default_operator_id 改为 default_operator_ids（JSONB数组）

支持多个默认生产人员。

Author: Auto
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            -- 如果存在 default_operator_id，迁移数据并删除
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_operations'
                AND column_name = 'default_operator_id'
            ) THEN
                -- 将单个 ID 转换为 JSON 数组
                UPDATE apps_master_data_operations
                SET default_operator_ids = CASE
                    WHEN default_operator_id IS NOT NULL THEN jsonb_build_array(default_operator_id)
                    ELSE NULL
                END
                WHERE default_operator_id IS NOT NULL;
                
                -- 删除旧字段
                ALTER TABLE apps_master_data_operations DROP COLUMN default_operator_id;
            END IF;
            
            -- 如果不存在 default_operator_ids，创建它
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_operations'
                AND column_name = 'default_operator_ids'
            ) THEN
                ALTER TABLE apps_master_data_operations
                ADD COLUMN default_operator_ids JSONB NULL;
                COMMENT ON COLUMN apps_master_data_operations.default_operator_ids IS '默认生产人员（用户ID列表，JSON数组，同组织）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            -- 如果存在 default_operator_ids，迁移回单个 ID
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_operations'
                AND column_name = 'default_operator_ids'
            ) THEN
                -- 添加单个 ID 字段
                ALTER TABLE apps_master_data_operations
                ADD COLUMN default_operator_id INT NULL;
                
                -- 从 JSON 数组提取第一个 ID
                UPDATE apps_master_data_operations
                SET default_operator_id = (default_operator_ids->>0)::INT
                WHERE default_operator_ids IS NOT NULL AND jsonb_array_length(default_operator_ids) > 0;
                
                -- 删除 JSON 字段
                ALTER TABLE apps_master_data_operations DROP COLUMN default_operator_ids;
            END IF;
        END $$;
    """
