"""生产物料库存移动流水表"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_stock_movements" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_by" INT NULL,
            "created_by_name" VARCHAR(100) NULL,
            "updated_by" INT NULL,
            "updated_by_name" VARCHAR(100) NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50),
            "batch_no" VARCHAR(100),
            "movement_type" VARCHAR(50) NOT NULL,
            "quantity" NUMERIC(18,4) NOT NULL,
            "qty_before" NUMERIC(18,4),
            "qty_after" NUMERIC(18,4),
            "from_warehouse_id" INT,
            "from_warehouse_name" VARCHAR(200),
            "to_warehouse_id" INT,
            "to_warehouse_name" VARCHAR(200),
            "balance_warehouse_id" INT,
            "source_doc_type" VARCHAR(50),
            "source_doc_id" INT,
            "source_doc_code" VARCHAR(64),
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "remark" TEXT,
            "idempotency_key" VARCHAR(200)
        );
        CREATE INDEX IF NOT EXISTS "idx_msm_tenant_wo_created"
            ON "apps_kuaizhizao_material_stock_movements" ("tenant_id", "work_order_id", "created_at");
        CREATE INDEX IF NOT EXISTS "idx_msm_tenant_mat_created"
            ON "apps_kuaizhizao_material_stock_movements" ("tenant_id", "material_id", "created_at");
        CREATE INDEX IF NOT EXISTS "idx_msm_tenant_source_doc"
            ON "apps_kuaizhizao_material_stock_movements" ("tenant_id", "source_doc_type", "source_doc_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_msm_tenant_idempotency"
            ON "apps_kuaizhizao_material_stock_movements" ("tenant_id", "idempotency_key")
            WHERE "idempotency_key" IS NOT NULL;
        COMMENT ON TABLE "apps_kuaizhizao_material_stock_movements" IS '快格轻制造 - 生产物料库存移动流水';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_stock_movements";
    """
