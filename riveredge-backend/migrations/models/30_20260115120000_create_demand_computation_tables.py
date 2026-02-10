"""
数据库迁移：创建统一需求计算表和需求计算明细表

创建 apps_kuaizhizao_demand_computations 和 apps_kuaizhizao_demand_computation_items 表，
用于统一需求计算（MRP/LRP）及明细存储。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：创建统一需求计算表及明细表。
    """
    return """
        -- 创建统一需求计算表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_computations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "computation_code" VARCHAR(50) NOT NULL,
            "demand_id" INT NOT NULL,
            "demand_code" VARCHAR(50) NOT NULL,
            "demand_type" VARCHAR(20) NOT NULL,
            "business_mode" VARCHAR(20) NOT NULL,
            "computation_type" VARCHAR(20) NOT NULL,
            "computation_params" JSONB NOT NULL DEFAULT '{}',
            "computation_status" VARCHAR(20) NOT NULL DEFAULT '进行中',
            "computation_start_time" TIMESTAMPTZ,
            "computation_end_time" TIMESTAMPTZ,
            "computation_summary" JSONB,
            "error_message" TEXT,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT
        );
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_tenant_demand" ON "apps_kuaizhizao_demand_computations" ("tenant_id", "demand_id");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_tenant_type" ON "apps_kuaizhizao_demand_computations" ("tenant_id", "computation_type");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_tenant_status" ON "apps_kuaizhizao_demand_computations" ("tenant_id", "computation_status");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_code" ON "apps_kuaizhizao_demand_computations" ("computation_code");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_start_time" ON "apps_kuaizhizao_demand_computations" ("computation_start_time");
        COMMENT ON TABLE "apps_kuaizhizao_demand_computations" IS '快格轻制造 - 统一需求计算';

        -- 创建统一需求计算明细表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_computation_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "computation_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "material_source_type" VARCHAR(20),
            "material_source_config" JSONB,
            "source_validation_passed" BOOLEAN NOT NULL DEFAULT true,
            "source_validation_errors" JSONB,
            "required_quantity" DECIMAL(10,2) NOT NULL,
            "available_inventory" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "net_requirement" DECIMAL(10,2) NOT NULL,
            "gross_requirement" DECIMAL(10,2),
            "safety_stock" DECIMAL(10,2),
            "reorder_point" DECIMAL(10,2),
            "planned_receipt" DECIMAL(10,2),
            "planned_release" DECIMAL(10,2),
            "delivery_date" DATE,
            "planned_production" DECIMAL(10,2),
            "planned_procurement" DECIMAL(10,2),
            "production_start_date" DATE,
            "production_completion_date" DATE,
            "procurement_start_date" DATE,
            "procurement_completion_date" DATE,
            "bom_id" INT,
            "bom_version" VARCHAR(20),
            "suggested_work_order_quantity" DECIMAL(10,2),
            "suggested_purchase_order_quantity" DECIMAL(10,2),
            "detail_results" JSONB,
            "notes" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_items_tenant_comp" ON "apps_kuaizhizao_demand_computation_items" ("tenant_id", "computation_id");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_items_tenant_material" ON "apps_kuaizhizao_demand_computation_items" ("tenant_id", "material_id");
        CREATE INDEX IF NOT EXISTS "idx_demand_comp_items_delivery_date" ON "apps_kuaizhizao_demand_computation_items" ("delivery_date");
        COMMENT ON TABLE "apps_kuaizhizao_demand_computation_items" IS '快格轻制造 - 统一需求计算明细';
    """
