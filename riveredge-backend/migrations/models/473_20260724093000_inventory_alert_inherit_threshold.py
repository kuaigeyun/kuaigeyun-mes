"""库存预警规则：继承物料阈值标志；阈值可空（继承时）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules"
    ADD COLUMN IF NOT EXISTS "inherit_material_threshold" BOOL NOT NULL DEFAULT FALSE;
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules"
    ALTER COLUMN "threshold_value" DROP NOT NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE "apps_kuaizhizao_inventory_alert_rules"
    SET "threshold_value" = 0
    WHERE "threshold_value" IS NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules"
    ALTER COLUMN "threshold_value" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alert_rules"
    DROP COLUMN IF EXISTS "inherit_material_threshold";
"""
