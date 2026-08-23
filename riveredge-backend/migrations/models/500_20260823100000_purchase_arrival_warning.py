"""
采购到货预警与延期填报表

- purchase_order_items.demand_computation_item_id
- apps_kuaizhizao_purchase_arrival_delay_reports
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
        ADD COLUMN IF NOT EXISTS "demand_computation_item_id" INT;

        CREATE INDEX IF NOT EXISTS "idx_po_items_dc_item"
        ON "apps_kuaizhizao_purchase_order_items" ("tenant_id", "demand_computation_item_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_arrival_delay_reports" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "report_code" VARCHAR(50) NOT NULL,
            "purchase_order_id" INT NOT NULL,
            "purchase_order_item_id" INT NOT NULL,
            "order_code" VARCHAR(50) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "supplier_id" INT,
            "supplier_name" VARCHAR(200),
            "planned_arrival_date" DATE NOT NULL,
            "delay_reason" VARCHAR(50) NOT NULL,
            "estimated_arrival_date" DATE NOT NULL,
            "impact_description" TEXT,
            "impacted_assembly_summary" VARCHAR(500),
            "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "purchase_order_change_id" INT,
            "purchase_order_change_code" VARCHAR(50),
            "attachments" JSONB,
            "notes" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_po_delay_tenant_item"
        ON "apps_kuaizhizao_purchase_arrival_delay_reports" ("tenant_id", "purchase_order_item_id");

        CREATE INDEX IF NOT EXISTS "idx_po_delay_tenant_status"
        ON "apps_kuaizhizao_purchase_arrival_delay_reports" ("tenant_id", "status");

        CREATE INDEX IF NOT EXISTS "idx_po_delay_tenant_code"
        ON "apps_kuaizhizao_purchase_arrival_delay_reports" ("tenant_id", "report_code");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_arrival_delay_reports";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
        DROP COLUMN IF EXISTS "demand_computation_item_id";
    """
