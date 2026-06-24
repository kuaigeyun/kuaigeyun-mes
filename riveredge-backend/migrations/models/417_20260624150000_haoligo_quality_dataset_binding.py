"""好力 GO — 品质制令单 ERP 数据集关联配置表。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_quality_dataset_binding" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "tenant_id" INT NOT NULL,
            "dataset_uuid" VARCHAR(36),
            "work_order_param_key" VARCHAR(64),
            "workshop_name_column" VARCHAR(128),
            "production_line_column" VARCHAR(128),
            "equipment_asset_code_column" VARCHAR(128),
            "mold_code_column" VARCHAR(128),
            "finished_product_code_column" VARCHAR(128),
            "finished_product_name_column" VARCHAR(128)
        );
        CREATE INDEX IF NOT EXISTS "idx_hqdb_tenant" ON "haoligo_quality_dataset_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_quality_dataset_binding";
    """

