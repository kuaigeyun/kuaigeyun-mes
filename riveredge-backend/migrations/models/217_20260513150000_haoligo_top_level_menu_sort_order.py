"""
将好力 GO 应用根下四个一级菜单的 sort_order 与 manifest 对齐，
避免历史数据均为 0 时按 created_at 显示成「设备」在「模具」之前。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_menus"
        SET "sort_order" = 0, "updated_at" = NOW()
        WHERE "deleted_at" IS NULL AND "path" = '/apps/haoligo/workspace';

        UPDATE "core_menus"
        SET "sort_order" = 10, "updated_at" = NOW()
        WHERE "deleted_at" IS NULL AND "path" = '/apps/haoligo/molds';

        UPDATE "core_menus"
        SET "sort_order" = 20, "updated_at" = NOW()
        WHERE "deleted_at" IS NULL AND "path" = '/apps/haoligo/equipment';

        UPDATE "core_menus"
        SET "sort_order" = 30, "updated_at" = NOW()
        WHERE "deleted_at" IS NULL AND "path" = '/apps/haoligo/patrol';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """无法恢复各租户历史 sort_order，降级不执行 SQL。"""
    return "-- haoligo top-level menu sort_order: no-op downgrade"
