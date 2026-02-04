"""
Dataset 表增加 integration_config_id，用于数据连接/数据源统一（DataSource -> IntegrationConfig）

- core_datasets 增加 integration_config_id（可空，FK -> core_integration_configs.id）
- 数据回填由脚本 migrate_data_sources_to_integration_configs 完成后再将本列改为 NOT NULL 并删除 data_source_id

Author: Plan B 数据连接与数据源后端统一
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $migration$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'core_datasets'
                AND column_name = 'integration_config_id'
            ) THEN
                ALTER TABLE "core_datasets"
                ADD COLUMN "integration_config_id" INT4 NULL;
                COMMENT ON COLUMN "core_datasets"."integration_config_id" IS '关联集成配置/数据连接（统一后替代 data_source_id）';
                CREATE INDEX IF NOT EXISTS "idx_core_datasets_integration_config_id"
                ON "public"."core_datasets" ("integration_config_id");
                ALTER TABLE "core_datasets"
                ADD CONSTRAINT "fk_core_datasets_integration_config_id"
                FOREIGN KEY ("integration_config_id") REFERENCES "core_integration_configs"("id") ON DELETE RESTRICT;
            END IF;
        END $migration$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_datasets" DROP CONSTRAINT IF EXISTS "fk_core_datasets_integration_config_id";
        DROP INDEX IF EXISTS "public"."idx_core_datasets_integration_config_id";
        ALTER TABLE "core_datasets" DROP COLUMN IF EXISTS "integration_config_id";
    """
