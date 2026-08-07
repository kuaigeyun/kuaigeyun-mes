"""
创建快制造物流管理表

Author: RiverEdge Team
Date: 2026-08-07
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_logistics_carriers" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "carrier_type" VARCHAR(30) NOT NULL DEFAULT 'express',
            "contact_name" VARCHAR(100),
            "contact_phone" VARCHAR(50),
            "settlement_method" VARCHAR(50),
            "supplier_id" INT,
            "remark" TEXT,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_logistics_carriers_tenant" ON "apps_kuaizhizao_logistics_carriers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_logistics_carriers_code" ON "apps_kuaizhizao_logistics_carriers" ("code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_vehicles" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "plate_number" VARCHAR(30) NOT NULL,
            "vehicle_type" VARCHAR(50),
            "load_capacity" DECIMAL(12,2),
            "volume_capacity" DECIMAL(12,2),
            "ownership" VARCHAR(20) NOT NULL DEFAULT 'internal',
            "carrier_id" INT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'idle',
            "remark" TEXT,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_vehicles_tenant" ON "apps_kuaizhizao_vehicles" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_vehicles_plate" ON "apps_kuaizhizao_vehicles" ("plate_number");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_drivers" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "phone" VARCHAR(50),
            "license_number" VARCHAR(50),
            "ownership" VARCHAR(20) NOT NULL DEFAULT 'internal',
            "carrier_id" INT,
            "user_id" INT,
            "default_vehicle_id" INT,
            "remark" TEXT,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_drivers_tenant" ON "apps_kuaizhizao_drivers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_drivers_code" ON "apps_kuaizhizao_drivers" ("code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "order_code" VARCHAR(50) NOT NULL,
            "business_direction" VARCHAR(30) NOT NULL,
            "transport_mode" VARCHAR(30) NOT NULL DEFAULT 'external_carrier',
            "carrier_id" INT,
            "carrier_name" VARCHAR(200),
            "vehicle_id" INT,
            "vehicle_plate" VARCHAR(30),
            "driver_id" INT,
            "driver_name" VARCHAR(100),
            "driver_phone" VARCHAR(50),
            "tracking_number" VARCHAR(100),
            "origin_address" TEXT,
            "destination_address" TEXT,
            "planned_depart_at" TIMESTAMPTZ,
            "planned_arrive_at" TIMESTAMPTZ,
            "actual_depart_at" TIMESTAMPTZ,
            "actual_arrive_at" TIMESTAMPTZ,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "remark" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_orders_tenant" ON "apps_kuaizhizao_freight_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_orders_code" ON "apps_kuaizhizao_freight_orders" ("order_code");
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_orders_status" ON "apps_kuaizhizao_freight_orders" ("status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_order_sources" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "freight_order_id" INT NOT NULL,
            "source_type" VARCHAR(50) NOT NULL,
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "partner_name" VARCHAR(200)
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_sources_order" ON "apps_kuaizhizao_freight_order_sources" ("freight_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_tracking_events" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "freight_order_id" INT NOT NULL,
            "event_type" VARCHAR(30) NOT NULL,
            "event_time" TIMESTAMPTZ NOT NULL,
            "location" VARCHAR(200),
            "remark" TEXT,
            "operator_id" INT,
            "operator_name" VARCHAR(100)
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_events_order" ON "apps_kuaizhizao_freight_tracking_events" ("freight_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_order_receipts" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "freight_order_id" INT NOT NULL,
            "signed_by" VARCHAR(100) NOT NULL,
            "signed_at" TIMESTAMPTZ NOT NULL,
            "receipt_result" VARCHAR(30) NOT NULL DEFAULT 'full',
            "remark" TEXT,
            "attachments" JSONB
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_receipts_order" ON "apps_kuaizhizao_freight_order_receipts" ("freight_order_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_bills" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "bill_code" VARCHAR(50) NOT NULL,
            "carrier_id" INT NOT NULL,
            "carrier_name" VARCHAR(200) NOT NULL,
            "period_start" DATE,
            "period_end" DATE,
            "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "reviewed_at" TIMESTAMPTZ,
            "payable_id" INT,
            "payable_code" VARCHAR(50),
            "remark" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_bills_tenant" ON "apps_kuaizhizao_freight_bills" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_bills_code" ON "apps_kuaizhizao_freight_bills" ("bill_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_freight_bill_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "freight_bill_id" INT NOT NULL,
            "freight_order_id" INT NOT NULL,
            "freight_order_code" VARCHAR(50) NOT NULL,
            "fee_type" VARCHAR(30) NOT NULL DEFAULT 'base',
            "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "remark" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_kz_freight_bill_items_bill" ON "apps_kuaizhizao_freight_bill_items" ("freight_bill_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_bill_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_bills" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_order_receipts" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_tracking_events" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_order_sources" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_freight_orders" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_drivers" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_vehicles" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_logistics_carriers" CASCADE;
    """
