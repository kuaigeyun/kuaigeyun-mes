"""库存预警规则：物料分组范围字段。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" ADD COLUMN IF NOT EXISTS "material_group_id" INT;
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" ADD COLUMN IF NOT EXISTS "material_group_name" VARCHAR(200);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" DROP COLUMN IF EXISTS "material_group_name";
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" DROP COLUMN IF EXISTS "material_group_id";
    """
