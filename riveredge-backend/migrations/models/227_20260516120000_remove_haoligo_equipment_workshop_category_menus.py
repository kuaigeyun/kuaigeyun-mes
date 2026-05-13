"""
好力 GO 设备「车间档案」「设备分类」独立菜单已下线（与 manifest 一致，主数据在设备总览/台账流程中维护）。

对已入库的 core_menus 做软删除，避免侧栏仍显示历史同步项。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_menus"
        SET "deleted_at" = NOW(),
            "updated_at" = NOW()
        WHERE "deleted_at" IS NULL
          AND (
            "path" IN (
              '/apps/haoligo/equipment/workshops',
              '/apps/haoligo/equipment/categories'
            )
            OR "path" LIKE '/apps/haoligo/equipment/workshops/%'
            OR "path" LIKE '/apps/haoligo/equipment/categories/%'
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- haoligo equipment workshops/categories menus: no-op downgrade"
