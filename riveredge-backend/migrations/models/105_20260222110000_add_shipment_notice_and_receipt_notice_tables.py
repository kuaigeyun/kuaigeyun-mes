"""
创建发货通知单和收货通知单表

业务单据补齐：发货通知单（销售）、收货通知单（采购）

Author: RiverEdge Team
Date: 2026-02-22
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建发货通知单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_shipment_notices" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "notice_code" VARCHAR(50) NOT NULL UNIQUE,
            "sales_order_id" INT NOT NULL,
            "sales_order_code" VARCHAR(50) NOT NULL,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(50),
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(100),
            "planned_ship_date" DATE,
            "shipping_address" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待发货',
            "notified_at" TIMESTAMPTZ,
            "sales_delivery_id" INT,
            "sales_delivery_code" VARCHAR(50),
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notices_tenant_id" ON "apps_kuaizhizao_shipment_notices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notices_notice_code" ON "apps_kuaizhizao_shipment_notices" ("notice_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notices_sales_order_id" ON "apps_kuaizhizao_shipment_notices" ("sales_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notices_customer_id" ON "apps_kuaizhizao_shipment_notices" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notices_status" ON "apps_kuaizhizao_shipment_notices" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_shipment_notices" IS '快格轻制造 - 发货通知单';

        -- ============================================
        -- 2. 创建发货通知单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_shipment_notice_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "notice_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "notice_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "sales_order_item_id" INT,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notice_items_tenant_id" ON "apps_kuaizhizao_shipment_notice_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notice_items_notice_id" ON "apps_kuaizhizao_shipment_notice_items" ("notice_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_shipment_notice_items_material_id" ON "apps_kuaizhizao_shipment_notice_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_shipment_notice_items" IS '快格轻制造 - 发货通知单明细';

        -- ============================================
        -- 3. 创建收货通知单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_receipt_notices" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "notice_code" VARCHAR(50) NOT NULL UNIQUE,
            "purchase_order_id" INT NOT NULL,
            "purchase_order_code" VARCHAR(50) NOT NULL,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "supplier_contact" VARCHAR(100),
            "supplier_phone" VARCHAR(50),
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(100),
            "planned_receipt_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT '待收货',
            "notified_at" TIMESTAMPTZ,
            "purchase_receipt_id" INT,
            "purchase_receipt_code" VARCHAR(50),
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notices_tenant_id" ON "apps_kuaizhizao_receipt_notices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notices_notice_code" ON "apps_kuaizhizao_receipt_notices" ("notice_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notices_purchase_order_id" ON "apps_kuaizhizao_receipt_notices" ("purchase_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notices_supplier_id" ON "apps_kuaizhizao_receipt_notices" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notices_status" ON "apps_kuaizhizao_receipt_notices" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_receipt_notices" IS '快格轻制造 - 收货通知单';

        -- ============================================
        -- 4. 创建收货通知单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_receipt_notice_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "notice_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "notice_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "purchase_order_item_id" INT,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notice_items_tenant_id" ON "apps_kuaizhizao_receipt_notice_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notice_items_notice_id" ON "apps_kuaizhizao_receipt_notice_items" ("notice_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_receipt_notice_items_material_id" ON "apps_kuaizhizao_receipt_notice_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_receipt_notice_items" IS '快格轻制造 - 收货通知单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_receipt_notice_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_receipt_notices" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_shipment_notice_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_shipment_notices" CASCADE;
    """
