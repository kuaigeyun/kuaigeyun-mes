"""生产领料明细增加序列号字段。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_production_picking_items"
            ADD COLUMN IF NOT EXISTS "serial_numbers" JSONB;

        COMMENT ON COLUMN "apps_kuaizhizao_production_picking_items"."serial_numbers"
            IS '序列号列表（JSON格式，存储多个序列号）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_production_picking_items"
            DROP COLUMN IF EXISTS "serial_numbers";
    """
