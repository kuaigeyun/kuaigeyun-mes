from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(100);
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "shelf_life_managed" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "shelf_life_days" INT;
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "reference_cost" DECIMAL(12,4);
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "country_of_origin" VARCHAR(100);
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "customs_code" VARCHAR(50);
        COMMENT ON COLUMN "apps_master_data_materials"."barcode" IS '条码/GTIN/EAN';
        COMMENT ON COLUMN "apps_master_data_materials"."shelf_life_managed" IS '是否启用保质期管理';
        COMMENT ON COLUMN "apps_master_data_materials"."shelf_life_days" IS '保质期天数';
        COMMENT ON COLUMN "apps_master_data_materials"."reference_cost" IS '参考成本';
        COMMENT ON COLUMN "apps_master_data_materials"."country_of_origin" IS '原产国';
        COMMENT ON COLUMN "apps_master_data_materials"."customs_code" IS '海关编码';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "customs_code";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "country_of_origin";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "reference_cost";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "shelf_life_days";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "shelf_life_managed";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "barcode";
    """
