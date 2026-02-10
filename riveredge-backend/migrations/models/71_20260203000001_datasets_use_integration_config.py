"""
Dataset 表改为仅使用 integration_config_id，删除 data_source_id

前置：已执行 70 及数据迁移脚本 apply_data_sources_to_integration_configs_migration.py。
- 删除 core_datasets.data_source_id 及其外键
- integration_config_id 设为 NOT NULL（已回填）

Author: Plan B 数据连接与数据源后端统一
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_datasets" DROP CONSTRAINT IF EXISTS "fk_core_datasets_data_source_id";
        DROP INDEX IF EXISTS "public"."idx_core_datasets_data_source_id";
        ALTER TABLE "core_datasets" DROP COLUMN IF EXISTS "data_source_id";
        ALTER TABLE "core_datasets" ALTER COLUMN "integration_config_id" SET NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_datasets" ALTER COLUMN "integration_config_id" DROP NOT NULL;
        ALTER TABLE "core_datasets" ADD COLUMN IF NOT EXISTS "data_source_id" INT4 NULL;
        CREATE INDEX IF NOT EXISTS "idx_core_datasets_data_source_id" ON "public"."core_datasets" ("data_source_id");
        ALTER TABLE "core_datasets" ADD CONSTRAINT "fk_core_datasets_data_source_id"
            FOREIGN KEY ("data_source_id") REFERENCES "core_data_sources"("id") ON DELETE RESTRICT;
    """
