"""
为仓库表添加关联工位字段（线边仓精细化管理）

apps_master_data_warehouses 表增加：
- workstation_id: 关联工位ID（可选，工位级线边仓）
- workstation_name: 关联工位名称

Author: AI Assistant
Date: 2026-03-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为 apps_master_data_warehouses 添加 workstation_id, workstation_name
    """
    return """
        DO $migration$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'workstation_id'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "workstation_id" INT NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."workstation_id" IS '关联工位ID（工位级线边仓可选）';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'workstation_name'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "workstation_name" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."workstation_name" IS '关联工位名称';
            END IF;
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚：移除 workstation_id, workstation_name
    """
    return """
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "workstation_name";
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "workstation_id";
    """
