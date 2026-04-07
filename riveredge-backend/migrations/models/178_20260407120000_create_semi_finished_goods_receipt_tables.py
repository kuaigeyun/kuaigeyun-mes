from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_semi_finished_goods_receipts" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "receipt_code" VARCHAR(50) NOT NULL UNIQUE,
    "work_order_id" INT NOT NULL,
    "work_order_code" VARCHAR(50) NOT NULL,
    "sales_order_id" INT,
    "sales_order_code" VARCHAR(50),
    "warehouse_id" INT NOT NULL,
    "warehouse_name" VARCHAR(100) NOT NULL,
    "receipt_time" TIMESTAMPTZ,
    "receiver_id" INT,
    "receiver_name" VARCHAR(100),
    "reviewer_id" INT,
    "reviewer_name" VARCHAR(100),
    "review_time" TIMESTAMPTZ,
    "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
    "review_remarks" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT '待入库',
    "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_by" INT,
    "updated_by" INT,
    "deleted_at" TIMESTAMPTZ
);
COMMENT ON TABLE "apps_kuaizhizao_semi_finished_goods_receipts" IS '快格轻制造 - 半成品入库单';
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_semi_finished_goods_receipt_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "receipt_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_spec" VARCHAR(200),
    "material_unit" VARCHAR(20) NOT NULL,
    "receipt_quantity" DECIMAL(10,2) NOT NULL,
    "qualified_quantity" DECIMAL(10,2) NOT NULL,
    "unqualified_quantity" DECIMAL(10,2) NOT NULL,
    "location_id" INT,
    "location_code" VARCHAR(50),
    "batch_number" VARCHAR(50),
    "expiry_date" DATE,
    "quality_status" VARCHAR(20) NOT NULL DEFAULT '合格',
    "quality_inspection_id" INT,
    "status" VARCHAR(20) NOT NULL DEFAULT '待入库',
    "receipt_time" TIMESTAMPTZ,
    "notes" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_sfgr_items_tenant_receipt" ON "apps_kuaizhizao_semi_finished_goods_receipt_items" ("tenant_id", "receipt_id");
CREATE INDEX IF NOT EXISTS "idx_sfgr_items_material" ON "apps_kuaizhizao_semi_finished_goods_receipt_items" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_sfgr_items_location" ON "apps_kuaizhizao_semi_finished_goods_receipt_items" ("location_id");
COMMENT ON TABLE "apps_kuaizhizao_semi_finished_goods_receipt_items" IS '快格轻制造 - 半成品入库单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_semi_finished_goods_receipt_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_semi_finished_goods_receipts";
    """
