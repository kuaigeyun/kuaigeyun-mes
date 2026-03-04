"""
创建采购物流记录表

供应商发货后录入运单号，用于在途物流跟踪。

Author: RiverEdge Team
Date: 2026-03-04
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_purchase_logistics" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "purchase_order_id" INT NOT NULL,
            "purchase_order_code" VARCHAR(50) NOT NULL,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "carrier" VARCHAR(100) NOT NULL,
            "tracking_number" VARCHAR(100) NOT NULL,
            "shipped_at" DATE,
            "expected_arrival" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT '在途',
            "receipt_notice_id" INT,
            "receipt_notice_code" VARCHAR(50),
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchase_logistics_tenant_id" ON "apps_kuaizhizao_purchase_logistics" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchase_logistics_purchase_order_id" ON "apps_kuaizhizao_purchase_logistics" ("purchase_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchase_logistics_supplier_id" ON "apps_kuaizhizao_purchase_logistics" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchase_logistics_tracking_number" ON "apps_kuaizhizao_purchase_logistics" ("tracking_number");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_purchase_logistics_status" ON "apps_kuaizhizao_purchase_logistics" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_purchase_logistics" IS '快格轻制造 - 采购物流记录';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_logistics" CASCADE;
    """
