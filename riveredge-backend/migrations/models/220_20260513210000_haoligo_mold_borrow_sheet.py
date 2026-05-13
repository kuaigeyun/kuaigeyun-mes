"""
好力 GO — 模具领用单 haoligo_mold_borrow_sheet。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_borrow_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_order_no" VARCHAR(128),
            "department_uuid" VARCHAR(36),
            "department_name" VARCHAR(200) NOT NULL,
            "mold_code" VARCHAR(64) NOT NULL,
            "mold_name" VARCHAR(200) NOT NULL,
            "finished_product_code" VARCHAR(128),
            "finished_product_name" VARCHAR(200),
            "planned_qty" NUMERIC(18,4),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mbs_tenant" ON "haoligo_mold_borrow_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mbs_mold" ON "haoligo_mold_borrow_sheet" ("mold_code");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mbs_src" ON "haoligo_mold_borrow_sheet" ("source_order_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_borrow_sheet" CASCADE;
    """
