"""好力 GO — 模具仓库表"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_warehouse" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "warehouse_code" VARCHAR(64) NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "warehouse_type" VARCHAR(16) NOT NULL,
            "supplier_uuid" VARCHAR(36),
            "supplier_code" VARCHAR(64),
            "supplier_name" VARCHAR(200),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_warehouse_tenant"
            ON "haoligo_mold_warehouse" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_mold_warehouse_tenant_code"
            ON "haoligo_mold_warehouse" ("tenant_id", "warehouse_code") WHERE "deleted_at" IS NULL;
        COMMENT ON TABLE "haoligo_mold_warehouse" IS '好力GO - 模具仓库';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_warehouse";
    """
