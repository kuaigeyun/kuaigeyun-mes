"""
创建快制造售后服务模块表

Author: RiverEdge Team
Date: 2026-08-07
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_service_assets" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "asset_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "serial_number" VARCHAR(100),
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "sales_delivery_id" INT,
            "sales_delivery_code" VARCHAR(50),
            "install_execution_id" INT,
            "install_execution_code" VARCHAR(50),
            "install_address" VARCHAR(500),
            "accepted_at" TIMESTAMPTZ,
            "warranty_start_at" TIMESTAMPTZ,
            "warranty_end_at" TIMESTAMPTZ,
            "warranty_months" INT,
            "warranty_policy" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT '在用',
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_service_assets_tenant_code" ON "apps_kuaizhizao_service_assets" ("tenant_id", "asset_code");
        CREATE INDEX IF NOT EXISTS "idx_kz_service_assets_tenant_customer" ON "apps_kuaizhizao_service_assets" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_service_assets_tenant_serial" ON "apps_kuaizhizao_service_assets" ("tenant_id", "serial_number");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_repair_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "order_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "after_sales_ticket_id" INT,
            "after_sales_ticket_code" VARCHAR(50),
            "service_asset_id" INT,
            "service_asset_code" VARCHAR(50),
            "repair_mode" VARCHAR(20) NOT NULL DEFAULT '现场',
            "fault_category" VARCHAR(100),
            "fault_description" TEXT NOT NULL,
            "diagnosis_result" TEXT,
            "resolution" TEXT,
            "warranty_status" VARCHAR(20) NOT NULL DEFAULT '待判定',
            "warranty_override_reason" TEXT,
            "labor_cost" DECIMAL(14,2),
            "travel_cost" DECIMAL(14,2),
            "spare_part_cost" DECIMAL(14,2),
            "outsource_cost" DECIMAL(14,2),
            "total_cost" DECIMAL(14,2),
            "status" VARCHAR(20) NOT NULL DEFAULT '待派工',
            "site_address" VARCHAR(500),
            "reported_at" TIMESTAMPTZ NOT NULL,
            "closed_at" TIMESTAMPTZ,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_repair_orders_tenant_code" ON "apps_kuaizhizao_repair_orders" ("tenant_id", "order_code");
        CREATE INDEX IF NOT EXISTS "idx_kz_repair_orders_tenant_status" ON "apps_kuaizhizao_repair_orders" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_repair_order_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "repair_order_id" INT NOT NULL,
            "line_no" INT NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(14,4),
            "amount" DECIMAL(14,2),
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_repair_order_items_tenant_order" ON "apps_kuaizhizao_repair_order_items" ("tenant_id", "repair_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_service_dispatch_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "dispatch_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "source_type" VARCHAR(30) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "engineer_id" INT,
            "engineer_name" VARCHAR(100),
            "planned_start_at" TIMESTAMPTZ,
            "planned_end_at" TIMESTAMPTZ,
            "actual_start_at" TIMESTAMPTZ,
            "actual_end_at" TIMESTAMPTZ,
            "site_address" VARCHAR(500),
            "status" VARCHAR(20) NOT NULL DEFAULT '待接单',
            "checkin_at" TIMESTAMPTZ,
            "checkin_location" VARCHAR(200),
            "completion_notes" TEXT,
            "attachments" JSONB,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_service_dispatch_tenant_code" ON "apps_kuaizhizao_service_dispatch_orders" ("tenant_id", "dispatch_code");
        CREATE INDEX IF NOT EXISTS "idx_kz_service_dispatch_tenant_status" ON "apps_kuaizhizao_service_dispatch_orders" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_after_sales_spare_part_requisitions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "requisition_code" VARCHAR(50) NOT NULL,
            "source_type" VARCHAR(30) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(100),
            "other_outbound_id" INT,
            "other_outbound_code" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "reviewed_at" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_as_spare_req_tenant_code" ON "apps_kuaizhizao_after_sales_spare_part_requisitions" ("tenant_id", "requisition_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_after_sales_spare_part_requisition_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "requisition_id" INT NOT NULL,
            "line_no" INT NOT NULL,
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20),
            "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_as_spare_req_items_tenant" ON "apps_kuaizhizao_after_sales_spare_part_requisition_items" ("tenant_id", "requisition_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_service_settlements" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "settlement_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "warranty_free_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "chargeable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "reviewed_at" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_service_settlements_tenant_code" ON "apps_kuaizhizao_service_settlements" ("tenant_id", "settlement_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_service_settlement_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "settlement_id" INT NOT NULL,
            "line_no" INT NOT NULL,
            "source_type" VARCHAR(30) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "warranty_status" VARCHAR(20),
            "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_service_settlement_items_tenant" ON "apps_kuaizhizao_service_settlement_items" ("tenant_id", "settlement_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_return_visits" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "visit_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "source_type" VARCHAR(30) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "visit_method" VARCHAR(30) NOT NULL DEFAULT '电话',
            "satisfaction_score" INT,
            "feedback" TEXT,
            "visitor_id" INT,
            "visitor_name" VARCHAR(100),
            "visited_at" TIMESTAMPTZ NOT NULL,
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_return_visits_tenant_code" ON "apps_kuaizhizao_customer_return_visits" ("tenant_id", "visit_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_customer_return_visits" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_service_settlement_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_service_settlements" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_after_sales_spare_part_requisition_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_after_sales_spare_part_requisitions" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_service_dispatch_orders" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_repair_order_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_repair_orders" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_service_assets" CASCADE;
    """
