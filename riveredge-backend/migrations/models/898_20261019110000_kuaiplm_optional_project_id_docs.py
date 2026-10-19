"""物料评审/打样/BOM协同/样机制作书 project_id 可空（与试流/样品加工一致）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_material_reviews"
            ALTER COLUMN "project_id" DROP NOT NULL;
        ALTER TABLE "apps_kuaiplm_mold_sample_orders"
            ALTER COLUMN "project_id" DROP NOT NULL;
        ALTER TABLE "apps_kuaiplm_bom_collaborations"
            ALTER COLUMN "project_id" DROP NOT NULL;
        ALTER TABLE "apps_kuaiplm_prototype_build_sheets"
            ALTER COLUMN "project_id" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_material_reviews"
            ALTER COLUMN "project_id" SET NOT NULL;
        ALTER TABLE "apps_kuaiplm_mold_sample_orders"
            ALTER COLUMN "project_id" SET NOT NULL;
        ALTER TABLE "apps_kuaiplm_bom_collaborations"
            ALTER COLUMN "project_id" SET NOT NULL;
        ALTER TABLE "apps_kuaiplm_prototype_build_sheets"
            ALTER COLUMN "project_id" SET NOT NULL;
    """
