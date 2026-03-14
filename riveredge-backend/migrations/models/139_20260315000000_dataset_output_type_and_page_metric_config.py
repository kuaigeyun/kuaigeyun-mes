"""
指标纳入数据集管理改造 - 阶段一

- core_datasets 增加 output_type、display_config
- 新增 core_page_metric_config 表（页面与指标型数据集绑定）

Author: 指标纳入数据集管理改造
Date: 2026-03-15
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1. core_datasets 增加 output_type、display_config
        DO $migration$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'core_datasets'
                AND column_name = 'output_type'
            ) THEN
                ALTER TABLE "core_datasets"
                ADD COLUMN "output_type" VARCHAR(20) NOT NULL DEFAULT 'list';
                COMMENT ON COLUMN "core_datasets"."output_type" IS '输出类型：list(默认)/metric/multi_metric';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'core_datasets'
                AND column_name = 'display_config'
            ) THEN
                ALTER TABLE "core_datasets"
                ADD COLUMN "display_config" JSONB NULL;
                COMMENT ON COLUMN "core_datasets"."display_config" IS '指标展示配置（仅 metric/multi_metric 使用）';
            END IF;
        END $migration$;

        -- 2. 创建 core_page_metric_config 表
        CREATE TABLE IF NOT EXISTS "core_page_metric_config" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT4 NOT NULL,
            "page_path" VARCHAR(255) NOT NULL,
            "dataset_code" VARCHAR(50) NOT NULL,
            "sort_order" INT4 NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ(6)
        );
        COMMENT ON TABLE "core_page_metric_config" IS '页面指标配置：页面路径与指标型数据集绑定';
        COMMENT ON COLUMN "core_page_metric_config"."page_path" IS '页面路由，如 /apps/kuaizhizao/sales-orders';
        COMMENT ON COLUMN "core_page_metric_config"."dataset_code" IS '指标型数据集 code（multi_metric）';
        COMMENT ON COLUMN "core_page_metric_config"."sort_order" IS '排序';

        CREATE UNIQUE INDEX IF NOT EXISTS "uk_page_metric_config_tenant_path"
        ON "core_page_metric_config" ("tenant_id", "page_path")
        WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS "idx_page_metric_config_tenant_id"
        ON "core_page_metric_config" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_page_metric_config_page_path"
        ON "core_page_metric_config" ("page_path");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_page_metric_config";

        ALTER TABLE "core_datasets" DROP COLUMN IF EXISTS "output_type";
        ALTER TABLE "core_datasets" DROP COLUMN IF EXISTS "display_config";
    """
