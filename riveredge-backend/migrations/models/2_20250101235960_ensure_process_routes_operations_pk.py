"""
补救迁移：确保 process_routes 与 operations 主键存在

针对「迁移2已执行但当时未包含此两表主键」的环境，在迁移28/33等添加外键之前
幂等地补齐主键，避免 InvalidForeignKeyError。

- 迁移28: parent_route_id REFERENCES process_routes(id)
- 迁移33: process_route_changes.process_route_id REFERENCES process_routes(id)
- 迁移65: operation_defect_types 引用 operations(id)

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- apps_master_data_process_routes 主键（迁移28/33外键依赖）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'apps_master_data_process_routes'::regclass
                AND contype = 'p'
            ) THEN
                ALTER TABLE "apps_master_data_process_routes"
                ADD CONSTRAINT "apps_master_data_process_routes_pkey" PRIMARY KEY ("id");
            END IF;
        END $$;

        -- apps_master_data_operations 主键（迁移65外键依赖）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'apps_master_data_operations'::regclass
                AND contype = 'p'
            ) THEN
                ALTER TABLE "apps_master_data_operations"
                ADD CONSTRAINT "apps_master_data_operations_pkey" PRIMARY KEY ("id");
            END IF;
        END $$;

        -- apps_master_data_defect_types 主键（迁移65外键依赖）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'apps_master_data_defect_types'::regclass
                AND contype = 'p'
            ) THEN
                ALTER TABLE "apps_master_data_defect_types"
                ADD CONSTRAINT "apps_master_data_defect_types_pkey" PRIMARY KEY ("id");
            END IF;
        END $$;

        -- core_integration_configs 主键（迁移70外键依赖）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'core_integration_configs'::regclass
                AND contype = 'p'
            ) THEN
                ALTER TABLE "core_integration_configs"
                ADD CONSTRAINT "core_integration_configs_pkey" PRIMARY KEY ("id");
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE IF EXISTS "apps_master_data_process_routes"
            DROP CONSTRAINT IF EXISTS "apps_master_data_process_routes_pkey";
        ALTER TABLE IF EXISTS "apps_master_data_operations"
            DROP CONSTRAINT IF EXISTS "apps_master_data_operations_pkey";
        ALTER TABLE IF EXISTS "apps_master_data_defect_types"
            DROP CONSTRAINT IF EXISTS "apps_master_data_defect_types_pkey";
        ALTER TABLE IF EXISTS "core_integration_configs"
            DROP CONSTRAINT IF EXISTS "core_integration_configs_pkey";
    """
