"""报价明细：属性组合（临时组合 / 与主物料联动）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            ADD COLUMN IF NOT EXISTS "variant_attributes" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_quotation_items"."variant_attributes"
            IS '行级属性组合（临时组合）；与主物料 variant_managed 或 Configure 配置件配合使用';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            DROP COLUMN IF EXISTS "variant_attributes";
    """
