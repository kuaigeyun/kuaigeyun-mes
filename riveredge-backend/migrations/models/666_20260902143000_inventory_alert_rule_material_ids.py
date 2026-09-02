"""库存预警规则：多物料范围 material_ids。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" ADD COLUMN IF NOT EXISTS "material_ids" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" DROP COLUMN IF EXISTS "material_ids";
    """
