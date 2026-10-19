from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_mold_sample_orders"
            ADD COLUMN IF NOT EXISTS "material_kind" VARCHAR(32);
        ALTER TABLE "apps_kuaiplm_mold_sample_orders"
            ADD COLUMN IF NOT EXISTS "material_name" VARCHAR(200);
        COMMENT ON COLUMN "apps_kuaiplm_mold_sample_orders"."material_kind" IS '打样订单物料种类：结构件/电子元器件/包装材料等';
        COMMENT ON COLUMN "apps_kuaiplm_mold_sample_orders"."material_name" IS '打样订单物料名称（手填）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_mold_sample_orders" DROP COLUMN IF EXISTS "material_name";
        ALTER TABLE "apps_kuaiplm_mold_sample_orders" DROP COLUMN IF EXISTS "material_kind";
    """
