"""
废弃物料来源类型 Configure：历史数据归并为 Buy。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_master_data_materials"
        SET "source_type" = 'Buy', "updated_at" = NOW()
        WHERE "source_type" = 'Configure' AND "deleted_at" IS NULL;

        UPDATE "apps_kuaizhizao_demand_computation_items"
        SET "material_source_type" = 'Buy', "updated_at" = NOW()
        WHERE "material_source_type" = 'Configure';

        COMMENT ON COLUMN "apps_master_data_materials"."source_type"
            IS '物料来源类型（Make/Buy/Phantom/Outsource/Service）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        COMMENT ON COLUMN "apps_master_data_materials"."source_type"
            IS '物料来源类型（Make/Buy/Phantom/Outsource/Configure）';
    """
