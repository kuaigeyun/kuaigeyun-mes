"""
物料/工序分场景质检策略 JSON；组织级 FQC 成品入库门禁参数由 business_config 管理（无 DDL）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "inspection_stages" JSONB NULL;
        COMMENT ON COLUMN "apps_master_data_materials"."inspection_stages"
            IS '分场景质检策略 JSON：iqc/fqc/oqc/ipqc 各含 mode、plan_id';

        ALTER TABLE "apps_master_data_operations"
            ADD COLUMN IF NOT EXISTS "inspection_stages" JSONB NULL;
        COMMENT ON COLUMN "apps_master_data_operations"."inspection_stages"
            IS '过程检验策略 JSON：ipqc 含 mode、plan_id';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_operations"
            DROP COLUMN IF EXISTS "inspection_stages";
        ALTER TABLE "apps_master_data_materials"
            DROP COLUMN IF EXISTS "inspection_stages";
    """
