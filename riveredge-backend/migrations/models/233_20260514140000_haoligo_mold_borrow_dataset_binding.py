"""好力 GO — 领用单数据集关联表 haoligo_mold_borrow_dataset_binding。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_mold_borrow_dataset_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "dataset_uuid" VARCHAR(36),
            "work_order_param_key" VARCHAR(64),
            "department_uuid_column" VARCHAR(128),
            "department_name_column" VARCHAR(128),
            "mold_code_column" VARCHAR(128),
            "mold_name_column" VARCHAR(128),
            "finished_product_code_column" VARCHAR(128),
            "finished_product_name_column" VARCHAR(128),
            "planned_qty_column" VARCHAR(128),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_haoligo_mborrow_ds_bind_tenant"
            ON "haoligo_mold_borrow_dataset_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_mold_borrow_dataset_binding" CASCADE;
    """
