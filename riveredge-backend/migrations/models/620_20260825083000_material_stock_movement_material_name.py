"""库存流水补物料名称，并回填历史行。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_stock_movements"
            ADD COLUMN IF NOT EXISTS "material_name" VARCHAR(200);

        COMMENT ON COLUMN "apps_kuaizhizao_material_stock_movements"."material_name"
            IS '物料名称（过账时落库）';

        UPDATE "apps_kuaizhizao_material_stock_movements" AS m
        SET
            "material_name" = mat."name",
            "material_code" = COALESCE(NULLIF(BTRIM(m."material_code"), ''), mat."main_code")
        FROM "apps_master_data_materials" AS mat
        WHERE mat."id" = m."material_id"
          AND mat."tenant_id" = m."tenant_id"
          AND mat."deleted_at" IS NULL
          AND (
              m."material_name" IS NULL
              OR BTRIM(m."material_name") = ''
              OR m."material_code" IS NULL
              OR BTRIM(m."material_code") = ''
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_material_stock_movements"
            DROP COLUMN IF EXISTS "material_name";
    """
