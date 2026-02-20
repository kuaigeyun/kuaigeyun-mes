"""
创建样品试用单表

阶段六：样品试用单 - 客户申请样品试用，可转正式销售订单

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建样品试用单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sample_trials" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "trial_code" VARCHAR(50) NOT NULL UNIQUE,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(50),
            "trial_purpose" VARCHAR(200),
            "trial_period_start" DATE,
            "trial_period_end" DATE,
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "other_outbound_id" INT,
            "other_outbound_code" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trials_tenant_id" ON "apps_kuaizhizao_sample_trials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trials_trial_code" ON "apps_kuaizhizao_sample_trials" ("trial_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trials_customer_id" ON "apps_kuaizhizao_sample_trials" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trials_status" ON "apps_kuaizhizao_sample_trials" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trials_sales_order_id" ON "apps_kuaizhizao_sample_trials" ("sales_order_id");

        COMMENT ON TABLE "apps_kuaizhizao_sample_trials" IS '快格轻制造 - 样品试用单';

        -- ============================================
        -- 2. 创建样品试用单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sample_trial_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "trial_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "trial_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trial_items_tenant_id" ON "apps_kuaizhizao_sample_trial_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trial_items_trial_id" ON "apps_kuaizhizao_sample_trial_items" ("trial_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sample_trial_items_material_id" ON "apps_kuaizhizao_sample_trial_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_sample_trial_items" IS '快格轻制造 - 样品试用单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_sample_trial_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_sample_trials" CASCADE;
    """
