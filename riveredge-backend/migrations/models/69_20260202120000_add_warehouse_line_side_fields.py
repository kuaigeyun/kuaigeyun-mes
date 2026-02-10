"""
为仓库表添加线边仓相关字段

apps_master_data_warehouses 表增加：
- warehouse_type: 仓库类型（normal/line_side/wip）
- workshop_id, workshop_name: 关联车间（线边仓）
- work_center_id, work_center_name: 关联工作中心

Author: Auto (AI Assistant)
Date: 2026-02-02
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为 apps_master_data_warehouses 添加线边仓字段
    使用单一 DO 块，便于 runner 按分号分割时只得到一条语句。
    """
    return """
        DO $migration$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'warehouse_type'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses"
                ADD COLUMN "warehouse_type" VARCHAR(20) NOT NULL DEFAULT 'normal';
                COMMENT ON COLUMN "apps_master_data_warehouses"."warehouse_type" IS '仓库类型（normal=普通仓库, line_side=线边仓, wip=在制品仓）';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'workshop_id'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "workshop_id" INT NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."workshop_id" IS '关联车间ID（线边仓时必填）';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'workshop_name'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "workshop_name" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."workshop_name" IS '关联车间名称';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'work_center_id'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "work_center_id" INT NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."work_center_id" IS '关联工作中心ID';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_warehouses'
                AND column_name = 'work_center_name'
            ) THEN
                ALTER TABLE "apps_master_data_warehouses" ADD COLUMN "work_center_name" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_master_data_warehouses"."work_center_name" IS '关联工作中心名称';
            END IF;
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚：移除 apps_master_data_warehouses 线边仓字段
    """
    return """
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "work_center_name";
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "work_center_id";
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "workshop_name";
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "workshop_id";
        ALTER TABLE "apps_master_data_warehouses" DROP COLUMN IF EXISTS "warehouse_type";
    """
