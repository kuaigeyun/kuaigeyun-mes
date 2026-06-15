"""
代工来料明细增加序列号字段
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_customer_material_registration_items"
        ADD COLUMN IF NOT EXISTS "serial_numbers" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registration_items"."serial_numbers"
            IS '序列号列表（JSON数组）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_customer_material_registration_items"
        DROP COLUMN IF EXISTS "serial_numbers";
    """
