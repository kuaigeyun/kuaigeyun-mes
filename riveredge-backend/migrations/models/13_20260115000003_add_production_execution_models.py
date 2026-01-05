"""
添加生产执行相关模型（P1优先级）

包含：
1. apps_kuaizhizao_scrap_records - 报废记录
2. apps_kuaizhizao_defect_records - 不良品记录
3. apps_kuaizhizao_material_bindings - 物料绑定

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加生产执行相关模型
    """
    return """
        -- ============================================
        -- 1. 创建报废记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_scrap_records" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "reporting_record_id" INT,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50) NOT NULL,
            "operation_name" VARCHAR(200) NOT NULL,
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "scrap_quantity" DECIMAL(18,4) NOT NULL,
            "unit_cost" DECIMAL(18,4),
            "total_cost" DECIMAL(18,4),
            "scrap_reason" TEXT NOT NULL,
            "scrap_type" VARCHAR(50) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "confirmed_at" TIMESTAMPTZ,
            "confirmed_by" INT,
            "confirmed_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_scrap_records_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_tenant_id" ON "apps_kuaizhizao_scrap_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_code" ON "apps_kuaizhizao_scrap_records" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_reporting_id" ON "apps_kuaizhizao_scrap_records" ("reporting_record_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_work_order_id" ON "apps_kuaizhizao_scrap_records" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_operation_id" ON "apps_kuaizhizao_scrap_records" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_status" ON "apps_kuaizhizao_scrap_records" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_scrap_type" ON "apps_kuaizhizao_scrap_records" ("scrap_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_scrap_records_created_at" ON "apps_kuaizhizao_scrap_records" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_scrap_records" IS '报废记录模型';
        
        -- ============================================
        -- 2. 创建不良品记录表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_defect_records" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "reporting_record_id" INT,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50) NOT NULL,
            "operation_name" VARCHAR(200) NOT NULL,
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "defect_quantity" DECIMAL(18,4) NOT NULL,
            "defect_type" VARCHAR(50) NOT NULL,
            "defect_reason" TEXT,
            "disposition" VARCHAR(50) NOT NULL,
            "quarantine_location" VARCHAR(200),
            "rework_order_id" INT,
            "scrap_record_id" INT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "processed_at" TIMESTAMPTZ,
            "processed_by" INT,
            "processed_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_defect_records_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_tenant_id" ON "apps_kuaizhizao_defect_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_code" ON "apps_kuaizhizao_defect_records" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_reporting_id" ON "apps_kuaizhizao_defect_records" ("reporting_record_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_work_order_id" ON "apps_kuaizhizao_defect_records" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_operation_id" ON "apps_kuaizhizao_defect_records" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_defect_type" ON "apps_kuaizhizao_defect_records" ("defect_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_disposition" ON "apps_kuaizhizao_defect_records" ("disposition");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_status" ON "apps_kuaizhizao_defect_records" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_defect_records_created_at" ON "apps_kuaizhizao_defect_records" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_defect_records" IS '不良品记录模型';
        
        -- ============================================
        -- 3. 创建物料绑定表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "reporting_record_id" INT NOT NULL,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50) NOT NULL,
            "operation_name" VARCHAR(200) NOT NULL,
            "binding_type" VARCHAR(20) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(18,4) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "location_id" INT,
            "location_code" VARCHAR(50),
            "batch_no" VARCHAR(50),
            "barcode" VARCHAR(100),
            "binding_method" VARCHAR(20) NOT NULL,
            "bound_by" INT,
            "bound_by_name" VARCHAR(100),
            "bound_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_tenant_id" ON "apps_kuaizhizao_material_bindings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_reporting_id" ON "apps_kuaizhizao_material_bindings" ("reporting_record_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_work_order_id" ON "apps_kuaizhizao_material_bindings" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_operation_id" ON "apps_kuaizhizao_material_bindings" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_material_id" ON "apps_kuaizhizao_material_bindings" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_binding_type" ON "apps_kuaizhizao_material_bindings" ("binding_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_bound_at" ON "apps_kuaizhizao_material_bindings" ("bound_at");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_bindings_created_at" ON "apps_kuaizhizao_material_bindings" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_material_bindings" IS '物料绑定记录模型';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除生产执行相关模型
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_bindings" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_defect_records" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_scrap_records" CASCADE;
    """

