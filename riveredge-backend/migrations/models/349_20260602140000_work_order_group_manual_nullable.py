"""手工组工单：需求计算/需求行 ID 允许为空。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_groups"
            ALTER COLUMN "root_demand_item_id" DROP NOT NULL,
            ALTER COLUMN "demand_computation_id" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_order_groups"
            ALTER COLUMN "root_demand_item_id" SET NOT NULL,
            ALTER COLUMN "demand_computation_id" SET NOT NULL;
    """
