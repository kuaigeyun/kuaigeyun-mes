"""
添加仓储管理相关模型（P1优先级）

包含：
1. apps_kuaizhizao_stocktakings - 盘点单
2. apps_kuaizhizao_stocktaking_items - 盘点单明细
3. apps_kuaizhizao_inventory_alerts - 库存预警
4. apps_kuaizhizao_inventory_alert_rules - 库存预警规则
5. apps_kuaizhizao_packing_bindings - 装箱绑定
6. apps_kuaizhizao_customer_material_registrations - 客户来料登记

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加仓储管理相关模型
    """
    return """
        -- ============================================
        -- 1. 创建盘点单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_stocktakings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "stocktaking_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "stocktaking_type" VARCHAR(20) NOT NULL DEFAULT 'full',
            "total_items" INT NOT NULL DEFAULT 0,
            "counted_items" INT NOT NULL DEFAULT 0,
            "total_differences" INT NOT NULL DEFAULT 0,
            "total_difference_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "approved_by" INT,
            "approved_by_name" VARCHAR(100),
            "approved_at" TIMESTAMPTZ,
            "completed_by" INT,
            "completed_by_name" VARCHAR(100),
            "completed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktakings_tenant_id" ON "apps_kuaizhizao_stocktakings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktakings_warehouse_id" ON "apps_kuaizhizao_stocktakings" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktakings_stocktaking_date" ON "apps_kuaizhizao_stocktakings" ("stocktaking_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktakings_status" ON "apps_kuaizhizao_stocktakings" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktakings_created_at" ON "apps_kuaizhizao_stocktakings" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_stocktakings" IS '库存盘点单模型';
        
        -- ============================================
        -- 2. 创建盘点单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_stocktaking_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "stocktaking_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "storage_location_id" INT,
            "storage_location_code" VARCHAR(50),
            "book_quantity" DECIMAL(18,4) NOT NULL,
            "counted_quantity" DECIMAL(18,4),
            "difference_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "difference_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(18,4),
            "batch_no" VARCHAR(50),
            "counted_by" INT,
            "counted_by_name" VARCHAR(100),
            "counted_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktaking_items_tenant_id" ON "apps_kuaizhizao_stocktaking_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktaking_items_stocktaking_id" ON "apps_kuaizhizao_stocktaking_items" ("stocktaking_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_stocktaking_items_material_id" ON "apps_kuaizhizao_stocktaking_items" ("material_id");
        
        COMMENT ON TABLE "apps_kuaizhizao_stocktaking_items" IS '库存盘点单明细模型';
        
        -- ============================================
        -- 3. 创建库存预警规则表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_alert_rules" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "alert_type" VARCHAR(20) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "threshold_type" VARCHAR(20) NOT NULL,
            "threshold_value" DECIMAL(12,2) NOT NULL,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "notify_users" JSONB,
            "notify_roles" JSONB,
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_tenant_id" ON "apps_kuaizhizao_inventory_alert_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_alert_type" ON "apps_kuaizhizao_inventory_alert_rules" ("alert_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_material_id" ON "apps_kuaizhizao_inventory_alert_rules" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_warehouse_id" ON "apps_kuaizhizao_inventory_alert_rules" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_is_enabled" ON "apps_kuaizhizao_inventory_alert_rules" ("is_enabled");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_alert_rules_created_at" ON "apps_kuaizhizao_inventory_alert_rules" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_inventory_alert_rules" IS '库存预警规则模型';
        
        -- ============================================
        -- 4. 创建库存预警表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_alerts" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "alert_rule_id" INT,
            "alert_type" VARCHAR(20) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "current_quantity" DECIMAL(18,4) NOT NULL,
            "threshold_value" DECIMAL(12,2) NOT NULL,
            "alert_level" VARCHAR(20) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
            "read_at" TIMESTAMPTZ,
            "read_by" INT,
            "resolved_at" TIMESTAMPTZ,
            "resolved_by" INT,
            "resolved_by_name" VARCHAR(100),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_tenant_id" ON "apps_kuaizhizao_inventory_alerts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_alert_rule_id" ON "apps_kuaizhizao_inventory_alerts" ("alert_rule_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_alert_type" ON "apps_kuaizhizao_inventory_alerts" ("alert_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_material_id" ON "apps_kuaizhizao_inventory_alerts" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_warehouse_id" ON "apps_kuaizhizao_inventory_alerts" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_alert_level" ON "apps_kuaizhizao_inventory_alerts" ("alert_level");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_status" ON "apps_kuaizhizao_inventory_alerts" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_is_read" ON "apps_kuaizhizao_inventory_alerts" ("is_read");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inventory_alerts_created_at" ON "apps_kuaizhizao_inventory_alerts" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_inventory_alerts" IS '库存预警模型';
        
        -- ============================================
        -- 5. 创建装箱绑定表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_packing_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "finished_goods_receipt_id" INT NOT NULL,
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "product_serial_no" VARCHAR(200),
            "packing_material_id" INT,
            "packing_material_code" VARCHAR(50),
            "packing_material_name" VARCHAR(200),
            "packing_quantity" DECIMAL(12,2) NOT NULL,
            "box_no" VARCHAR(100),
            "binding_method" VARCHAR(20) NOT NULL DEFAULT 'manual',
            "barcode" VARCHAR(200),
            "bound_by" INT NOT NULL,
            "bound_by_name" VARCHAR(100) NOT NULL,
            "bound_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_tenant_id" ON "apps_kuaizhizao_packing_bindings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_receipt_id" ON "apps_kuaizhizao_packing_bindings" ("finished_goods_receipt_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_product_id" ON "apps_kuaizhizao_packing_bindings" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_product_serial" ON "apps_kuaizhizao_packing_bindings" ("product_serial_no");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_packing_material" ON "apps_kuaizhizao_packing_bindings" ("packing_material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_bound_at" ON "apps_kuaizhizao_packing_bindings" ("bound_at");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_packing_bindings_created_at" ON "apps_kuaizhizao_packing_bindings" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_packing_bindings" IS '装箱打包绑定记录模型';
        
        -- ============================================
        -- 6. 创建客户来料登记表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_material_registrations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_code" VARCHAR(50) NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "external_material_code" VARCHAR(50),
            "external_material_name" VARCHAR(200),
            "barcode" VARCHAR(200),
            "barcode_type" VARCHAR(10) NOT NULL DEFAULT '1d',
            "quantity" DECIMAL(18,4) NOT NULL,
            "unit" VARCHAR(20),
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "registration_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "mapped_material_id" INT,
            "mapped_material_code" VARCHAR(50),
            "mapped_material_name" VARCHAR(200),
            "mapping_rule_id" INT,
            "registration_method" VARCHAR(20) NOT NULL DEFAULT 'manual',
            "registered_by" INT,
            "registered_by_name" VARCHAR(100),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_customer_mat_reg_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_tenant_id" ON "apps_kuaizhizao_customer_material_registrations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_code" ON "apps_kuaizhizao_customer_material_registrations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_customer_id" ON "apps_kuaizhizao_customer_material_registrations" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_material_id" ON "apps_kuaizhizao_customer_material_registrations" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_barcode" ON "apps_kuaizhizao_customer_material_registrations" ("barcode");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_status" ON "apps_kuaizhizao_customer_material_registrations" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_registration_date" ON "apps_kuaizhizao_customer_material_registrations" ("registration_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_mat_reg_created_at" ON "apps_kuaizhizao_customer_material_registrations" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_customer_material_registrations" IS '客户来料登记模型';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除仓储管理相关模型
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_material_registrations" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_packing_bindings" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_alerts" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_alert_rules" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_stocktaking_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_stocktakings" CASCADE;
    """

