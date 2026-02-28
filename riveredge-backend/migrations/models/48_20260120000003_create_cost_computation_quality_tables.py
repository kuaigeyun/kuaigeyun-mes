"""
数据库迁移：创建成本核算、需求计算参数、质检标准表

创建 apps_kuaizhizao_cost_rules、apps_kuaizhizao_cost_calculations、
apps_kuaizhizao_computation_configs、apps_kuaizhizao_quality_standards 表，
补全缺失的建表迁移。需在 49-55 的 ALTER 迁移之前执行。

Author: Migration Plan
Date: 2026-02-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建成本核算规则表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_cost_rules" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "rule_type" VARCHAR(50),
            "cost_type" VARCHAR(50) NOT NULL,
            "calculation_method" VARCHAR(50),
            "calculation_formula" JSONB,
            "rule_parameters" JSONB,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "description" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_cost_rules_tenant_code" UNIQUE ("tenant_id", "code")
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_tenant_id" ON "apps_kuaizhizao_cost_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_code" ON "apps_kuaizhizao_cost_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_rule_type" ON "apps_kuaizhizao_cost_rules" ("rule_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_cost_type" ON "apps_kuaizhizao_cost_rules" ("cost_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_is_active" ON "apps_kuaizhizao_cost_rules" ("is_active");

        COMMENT ON TABLE "apps_kuaizhizao_cost_rules" IS '快格轻制造 - 成本核算规则';

        -- ============================================
        -- 2. 创建成本核算表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_cost_calculations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "calculation_no" VARCHAR(50),
            "calculation_type" VARCHAR(50) NOT NULL,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "product_id" INT,
            "product_code" VARCHAR(50),
            "product_name" VARCHAR(200),
            "quantity" DECIMAL(12,2) NOT NULL,
            "material_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "labor_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "manufacturing_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unit_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "cost_details" JSONB,
            "calculation_date" DATE NOT NULL,
            "calculation_status" VARCHAR(50) NOT NULL DEFAULT '草稿',
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_cost_calcs_tenant_no" UNIQUE ("tenant_id", "calculation_no")
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_tenant_id" ON "apps_kuaizhizao_cost_calculations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_calculation_no" ON "apps_kuaizhizao_cost_calculations" ("calculation_no");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_calculation_type" ON "apps_kuaizhizao_cost_calculations" ("calculation_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_work_order_id" ON "apps_kuaizhizao_cost_calculations" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_product_id" ON "apps_kuaizhizao_cost_calculations" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_calculation_date" ON "apps_kuaizhizao_cost_calculations" ("calculation_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calcs_calculation_status" ON "apps_kuaizhizao_cost_calculations" ("calculation_status");

        COMMENT ON TABLE "apps_kuaizhizao_cost_calculations" IS '快格轻制造 - 成本核算';

        -- ============================================
        -- 3. 创建需求计算参数配置表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_computation_configs" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "config_code" VARCHAR(50) NOT NULL,
            "config_name" VARCHAR(200) NOT NULL,
            "config_scope" VARCHAR(50) NOT NULL DEFAULT 'global',
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "warehouse_id" INT,
            "warehouse_code" VARCHAR(50),
            "warehouse_name" VARCHAR(200),
            "computation_params" JSONB NOT NULL,
            "is_template" BOOLEAN NOT NULL DEFAULT FALSE,
            "template_name" VARCHAR(200),
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "priority" INT NOT NULL DEFAULT 0,
            "description" TEXT,
            "created_by" INT,
            "updated_by" INT,
            CONSTRAINT "uid_apps_kuaizh_computation_configs_tenant_code" UNIQUE ("tenant_id", "config_code")
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_tenant_scope" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "config_scope");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_tenant_material" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_tenant_warehouse" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_tenant_template" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "is_template");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_tenant_active" ON "apps_kuaizhizao_computation_configs" ("tenant_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_computation_configs_config_code" ON "apps_kuaizhizao_computation_configs" ("config_code");

        COMMENT ON TABLE "apps_kuaizhizao_computation_configs" IS '快格轻制造 - 需求计算参数配置';

        -- ============================================
        -- 4. 创建质检标准表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_standards" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "standard_code" VARCHAR(50) NOT NULL UNIQUE,
            "standard_name" VARCHAR(200) NOT NULL,
            "standard_type" VARCHAR(50) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "inspection_items" JSONB,
            "inspection_methods" JSONB,
            "acceptance_criteria" JSONB,
            "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
            "effective_date" DATE,
            "expiry_date" DATE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_tenant_id" ON "apps_kuaizhizao_quality_standards" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_standard_code" ON "apps_kuaizhizao_quality_standards" ("standard_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_material_id" ON "apps_kuaizhizao_quality_standards" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_standard_type" ON "apps_kuaizhizao_quality_standards" ("standard_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_is_active" ON "apps_kuaizhizao_quality_standards" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_standards_created_at" ON "apps_kuaizhizao_quality_standards" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_quality_standards" IS '快格轻制造 - 质量检验标准';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_standards" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_computation_configs" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_cost_calculations" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_cost_rules" CASCADE;"""
