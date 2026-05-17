"""
好力 GO 设备「集成设置 / 数据源说明」菜单暂时下线（与 manifest 一致）。

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
            "path" = '/apps/haoligo/equipment/settings/integration'
            OR "path" LIKE '/apps/haoligo/equipment/settings/integration/%'
            OR "name" IN (
              'app.haoligo.menu.equipment.group.integration',
              'app.haoligo.menu.equipment.settings.integration',
              '集成设置',
              '数据源说明'
            )
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- haoligo equipment integration menu: no-op downgrade"
