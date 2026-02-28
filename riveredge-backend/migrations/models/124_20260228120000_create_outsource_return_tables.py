from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_material_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "outsource_work_order_id" INT NOT NULL,
            "outsource_work_order_code" VARCHAR(50) NOT NULL,
            "outsource_material_issue_id" INT,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(12,2) NOT NULL,
            "unit" VARCHAR(20) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "location_id" INT,
            "batch_number" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "returned_at" TIMESTAMPTZ,
            "returned_by" INT,
            "returned_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT NOT NULL,
            "created_by_name" VARCHAR(100) NOT NULL,
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_outsource_material_returns_tenant_code"
            ON "apps_kuaizhizao_outsource_material_returns" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_returns_work_order"
            ON "apps_kuaizhizao_outsource_material_returns" ("outsource_work_order_id");
        COMMENT ON TABLE "apps_kuaizhizao_outsource_material_returns" IS '快格轻制造 - 委外退料单';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_product_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "outsource_work_order_id" INT NOT NULL,
            "outsource_work_order_code" VARCHAR(50) NOT NULL,
            "outsource_material_receipt_id" INT,
            "quantity" DECIMAL(12,2) NOT NULL,
            "unit" VARCHAR(20) NOT NULL,
            "return_reason" VARCHAR(500),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "returned_at" TIMESTAMPTZ,
            "returned_by" INT,
            "returned_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT NOT NULL,
            "created_by_name" VARCHAR(100) NOT NULL,
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_outsource_product_returns_tenant_code"
            ON "apps_kuaizhizao_outsource_product_returns" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_outsource_product_returns_work_order"
            ON "apps_kuaizhizao_outsource_product_returns" ("outsource_work_order_id");
        COMMENT ON TABLE "apps_kuaizhizao_outsource_product_returns" IS '快格轻制造 - 委外退货单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_material_returns" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_product_returns" CASCADE;
    """
