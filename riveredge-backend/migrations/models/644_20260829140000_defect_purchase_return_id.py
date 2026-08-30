"""
不合格品台账：采购退货单关联字段（退货处置闭环）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_defect_records"
            ADD COLUMN IF NOT EXISTS "purchase_return_id" INT;

        COMMENT ON COLUMN "apps_kuaizhizao_defect_records"."purchase_return_id" IS '退货处置生成的采购退货单ID';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_defect_records"
            DROP COLUMN IF EXISTS "purchase_return_id";
    """
