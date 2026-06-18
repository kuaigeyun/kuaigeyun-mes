"""
物料分组增加分场景默认质检策略（inspection_stages）
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_groups"
            ADD COLUMN IF NOT EXISTS "inspection_stages" JSONB NULL;
        COMMENT ON COLUMN "apps_master_data_material_groups"."inspection_stages"
            IS '分场景默认质检策略（组内物料未单独配置时继承）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_groups"
            DROP COLUMN IF EXISTS "inspection_stages";
    """
