"""
创建发货通知单表

阶段五：发货通知单 - 在销售出库前/后向客户发送发货通知

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建发货通知单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_notices" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "notice_code" VARCHAR(50) NOT NULL UNIQUE,
            "sales_delivery_id" INT,
            "sales_delivery_code" VARCHAR(50),
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(50),
            "planned_delivery_date" DATE,
            "carrier" VARCHAR(100),
            "tracking_number" VARCHAR(100),
            "shipping_address" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待发送',
            "sent_at" TIMESTAMPTZ,
            "signed_at" TIMESTAMPTZ,
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_tenant_id" ON "apps_kuaizhizao_delivery_notices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_notice_code" ON "apps_kuaizhizao_delivery_notices" ("notice_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_sales_delivery_id" ON "apps_kuaizhizao_delivery_notices" ("sales_delivery_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_sales_order_id" ON "apps_kuaizhizao_delivery_notices" ("sales_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_customer_id" ON "apps_kuaizhizao_delivery_notices" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notices_status" ON "apps_kuaizhizao_delivery_notices" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_delivery_notices" IS '快格轻制造 - 发货通知单';

        -- ============================================
        -- 2. 创建发货通知单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_notice_items" (
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
            "delivery_item_id" INT,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notice_items_tenant_id" ON "apps_kuaizhizao_delivery_notice_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notice_items_notice_id" ON "apps_kuaizhizao_delivery_notice_items" ("notice_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_notice_items_material_id" ON "apps_kuaizhizao_delivery_notice_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_delivery_notice_items" IS '快格轻制造 - 发货通知单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_notice_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_notices" CASCADE;
    """
