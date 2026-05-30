"""拆分后原工单 status：cancelled → split（有拆分子工单时）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_work_orders" AS parent
        SET "status" = 'split'
        WHERE parent."deleted_at" IS NULL
          AND parent."status" IN ('cancelled', '已取消')
          AND EXISTS (
              SELECT 1
              FROM "apps_kuaizhizao_work_orders" AS child
              WHERE child."parent_work_order_id" = parent.id
                AND child."deleted_at" IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_work_orders" AS parent
        SET "status" = 'cancelled'
        WHERE parent."deleted_at" IS NULL
          AND parent."status" IN ('split', '已拆分')
          AND EXISTS (
              SELECT 1
              FROM "apps_kuaizhizao_work_orders" AS child
              WHERE child."parent_work_order_id" = parent.id
                AND child."deleted_at" IS NULL
          );
    """
