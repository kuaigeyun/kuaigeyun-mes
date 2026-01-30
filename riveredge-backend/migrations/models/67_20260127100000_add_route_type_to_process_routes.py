"""
为 apps_master_data_process_routes 表添加 route_type 字段

工艺路线类型：simple（简易路线）/ with_sop（带SOP工艺路线）。
带SOP时工序序列中每个工序需关联 sop_uuid。

Author: 制造SOP开发计划
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_process_routes'
                AND column_name = 'route_type'
            ) THEN
                ALTER TABLE apps_master_data_process_routes
                ADD COLUMN route_type VARCHAR(20) NOT NULL DEFAULT 'simple';
                COMMENT ON COLUMN apps_master_data_process_routes.route_type IS '工艺路线类型：simple=简易路线，with_sop=带SOP工艺路线';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_process_routes'
                AND column_name = 'route_type'
            ) THEN
                ALTER TABLE apps_master_data_process_routes DROP COLUMN route_type;
            END IF;
        END $$;
    """
