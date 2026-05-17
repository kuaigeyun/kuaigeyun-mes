"""好力 GO — 设备产出单成品代号/名称字段及数据集列映射（对齐领用单）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
            ADD COLUMN IF NOT EXISTS "finished_product_code" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "finished_product_name" VARCHAR(200);

        UPDATE "haoligo_equipment_output_record"
        SET "finished_product_code" = "customer_name"
        WHERE "finished_product_code" IS NULL AND "customer_name" IS NOT NULL;

        UPDATE "haoligo_equipment_output_record"
        SET "finished_product_name" = "product_name"
        WHERE "finished_product_name" IS NULL AND "product_name" IS NOT NULL;

        ALTER TABLE "haoligo_equipment_output_dataset_binding"
            ADD COLUMN IF NOT EXISTS "finished_product_code_column" VARCHAR(128),
            ADD COLUMN IF NOT EXISTS "finished_product_name_column" VARCHAR(128);

        UPDATE "haoligo_equipment_output_dataset_binding"
        SET "finished_product_code_column" = "customer_column"
        WHERE "finished_product_code_column" IS NULL AND "customer_column" IS NOT NULL;

        UPDATE "haoligo_equipment_output_dataset_binding"
        SET "finished_product_name_column" = "product_name_column"
        WHERE "finished_product_name_column" IS NULL AND "product_name_column" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_output_record"
            DROP COLUMN IF EXISTS "finished_product_code",
            DROP COLUMN IF EXISTS "finished_product_name";

        ALTER TABLE "haoligo_equipment_output_dataset_binding"
            DROP COLUMN IF EXISTS "finished_product_code_column",
            DROP COLUMN IF EXISTS "finished_product_name_column";
    """
