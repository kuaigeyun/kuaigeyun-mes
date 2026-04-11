"""若库存预警规则表缺少 warehouse_id（非标准库或手工变更），补列后再依赖 COMMENT/索引。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" ADD COLUMN IF NOT EXISTS "warehouse_id" INT;
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules" ADD COLUMN IF NOT EXISTS "warehouse_name" VARCHAR(200);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
