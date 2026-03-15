"""
完全移除物料类型（material_type），简化物料属性为物料分组+物料来源类型

变更：
1. apps_master_data_materials: 删除 material_type 列
2. apps_kuaizhizao_production_plan_items: material_type 改为 source_type（存储物料来源类型）

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $migration$
        BEGIN
            -- 1. 物料表：删除 material_type
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials'
                AND column_name = 'material_type'
            ) THEN
                ALTER TABLE "apps_master_data_materials" DROP COLUMN "material_type";
            END IF;

            -- 2. 生产计划明细：添加 source_type，删除 material_type
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_production_plan_items'
                AND column_name = 'source_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_production_plan_items" ADD COLUMN "source_type" VARCHAR(20) NULL;
                UPDATE "apps_kuaizhizao_production_plan_items" SET "source_type" = 'Make' WHERE "source_type" IS NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_production_plan_items"."source_type" IS '物料来源类型（Make/Buy/Outsource等）';
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_production_plan_items'
                AND column_name = 'material_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_production_plan_items" DROP COLUMN "material_type";
            END IF;
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $migration$
        BEGIN
            -- 1. 物料表：恢复 material_type
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials'
                AND column_name = 'material_type'
            ) THEN
                ALTER TABLE "apps_master_data_materials" ADD COLUMN "material_type" VARCHAR(20) NULL DEFAULT 'RAW';
                COMMENT ON COLUMN "apps_master_data_materials"."material_type" IS '物料类型（FIN/SEMI/RAW/PACK/AUX）';
            END IF;

            -- 2. 生产计划明细：恢复 material_type，删除 source_type
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_production_plan_items'
                AND column_name = 'material_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_production_plan_items" ADD COLUMN "material_type" VARCHAR(20) NOT NULL DEFAULT '成品';
                COMMENT ON COLUMN "apps_kuaizhizao_production_plan_items"."material_type" IS '物料类型';
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_production_plan_items'
                AND column_name = 'source_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_production_plan_items" DROP COLUMN "source_type";
            END IF;
        END $migration$;
    """
