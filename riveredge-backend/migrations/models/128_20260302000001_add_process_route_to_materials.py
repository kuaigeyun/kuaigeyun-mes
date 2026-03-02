"""
为物料表和物料分组表添加 process_route_id 字段

Material 和 MaterialGroup 模型通过 ForeignKeyField 关联 ProcessRoute，
需在数据库中添加 process_route_id 列。

Author: RiverEdge Team
Date: 2026-03-02
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 物料分组表：添加 process_route_id
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_material_groups'
                AND column_name = 'process_route_id'
            ) THEN
                ALTER TABLE "apps_master_data_material_groups"
                ADD COLUMN "process_route_id" INT NULL
                REFERENCES "apps_master_data_process_routes" ("id") ON DELETE SET NULL;
                CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_process_route_id"
                ON "apps_master_data_material_groups" ("process_route_id");
                COMMENT ON COLUMN "apps_master_data_material_groups"."process_route_id" IS '绑定的工艺路线（分组级别）';
            END IF;
        END $$;

        -- 物料表：添加 process_route_id
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_master_data_materials'
                AND column_name = 'process_route_id'
            ) THEN
                ALTER TABLE "apps_master_data_materials"
                ADD COLUMN "process_route_id" INT NULL
                REFERENCES "apps_master_data_process_routes" ("id") ON DELETE SET NULL;
                CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_process_route_id"
                ON "apps_master_data_materials" ("process_route_id");
                COMMENT ON COLUMN "apps_master_data_materials"."process_route_id" IS '绑定的工艺路线（物料级别）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_master_data_material_groups_process_route_id";
        ALTER TABLE "apps_master_data_material_groups" DROP COLUMN IF EXISTS "process_route_id";

        DROP INDEX IF EXISTS "idx_apps_master_data_materials_process_route_id";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "process_route_id";
    """
