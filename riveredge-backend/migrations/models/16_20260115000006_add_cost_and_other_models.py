"""
添加成本核算和其他相关模型（P1/P2优先级）

包含：
1. apps_kuaizhizao_cost_rules - 成本规则
2. apps_kuaizhizao_cost_calculations - 成本核算
3. apps_kuaizhizao_document_node_timings - 单据节点耗时
4. apps_kuaizhizao_barcode_mapping_rules - 条码映射规则

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加成本核算和其他相关模型
    """
    return """
        -- ============================================
        -- 1. 创建成本规则表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_cost_rules" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "cost_type" VARCHAR(50) NOT NULL,
            "product_id" INT,
            "product_code" VARCHAR(50),
            "product_name" VARCHAR(200),
            "rule_config" JSONB NOT NULL,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "effective_date" TIMESTAMPTZ,
            "expiry_date" TIMESTAMPTZ,
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_cost_rules_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_tenant_id" ON "apps_kuaizhizao_cost_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_code" ON "apps_kuaizhizao_cost_rules" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_cost_type" ON "apps_kuaizhizao_cost_rules" ("cost_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_product_id" ON "apps_kuaizhizao_cost_rules" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_is_enabled" ON "apps_kuaizhizao_cost_rules" ("is_enabled");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_rules_created_at" ON "apps_kuaizhizao_cost_rules" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_cost_rules" IS '成本核算规则模型';
        
        -- ============================================
        -- 2. 创建成本核算表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_cost_calculations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "calculation_type" VARCHAR(50) NOT NULL,
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "calculation_date" TIMESTAMPTZ NOT NULL,
            "material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "labor_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "overhead_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "cost_details" JSONB,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "calculated_by" INT,
            "calculated_by_name" VARCHAR(100),
            "calculated_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_cost_calculations_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_tenant_id" ON "apps_kuaizhizao_cost_calculations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_code" ON "apps_kuaizhizao_cost_calculations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_calc_type" ON "apps_kuaizhizao_cost_calculations" ("calculation_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_product_id" ON "apps_kuaizhizao_cost_calculations" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_work_order_id" ON "apps_kuaizhizao_cost_calculations" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_calc_date" ON "apps_kuaizhizao_cost_calculations" ("calculation_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_status" ON "apps_kuaizhizao_cost_calculations" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_cost_calculations_created_at" ON "apps_kuaizhizao_cost_calculations" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_cost_calculations" IS '成本核算模型';
        
        -- ============================================
        -- 3. 创建单据节点耗时表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_document_node_timings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_type" VARCHAR(50) NOT NULL,
            "document_id" INT NOT NULL,
            "document_code" VARCHAR(50) NOT NULL,
            "node_name" VARCHAR(100) NOT NULL,
            "node_type" VARCHAR(50) NOT NULL,
            "start_time" TIMESTAMPTZ NOT NULL,
            "end_time" TIMESTAMPTZ,
            "duration_seconds" INT,
            "duration_minutes" DECIMAL(10,2),
            "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_tenant_id" ON "apps_kuaizhizao_document_node_timings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_doc_type" ON "apps_kuaizhizao_document_node_timings" ("document_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_doc_id" ON "apps_kuaizhizao_document_node_timings" ("document_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_node_type" ON "apps_kuaizhizao_document_node_timings" ("node_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_status" ON "apps_kuaizhizao_document_node_timings" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_start_time" ON "apps_kuaizhizao_document_node_timings" ("start_time");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_doc_node_timings_created_at" ON "apps_kuaizhizao_document_node_timings" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_document_node_timings" IS '单据节点耗时模型';
        
        -- ============================================
        -- 4. 创建条码映射规则表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_barcode_mapping_rules" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "customer_id" INT,
            "customer_name" VARCHAR(200),
            "barcode_pattern" VARCHAR(500) NOT NULL,
            "barcode_type" VARCHAR(10) NOT NULL DEFAULT '1d',
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "parsing_rule" JSONB,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "priority" INT NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_tenant_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_customer_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_material_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_is_enabled" ON "apps_kuaizhizao_barcode_mapping_rules" ("is_enabled");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_priority" ON "apps_kuaizhizao_barcode_mapping_rules" ("priority");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_rules_created_at" ON "apps_kuaizhizao_barcode_mapping_rules" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_barcode_mapping_rules" IS '条码映射规则模型';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除成本核算和其他相关模型
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_barcode_mapping_rules" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_document_node_timings" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_cost_calculations" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_cost_rules" CASCADE;
    """

