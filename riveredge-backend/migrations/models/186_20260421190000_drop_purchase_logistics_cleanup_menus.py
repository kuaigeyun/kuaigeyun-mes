"""
下线采购物流跟踪功能：drop 表 + 清理菜单/权限残留。

采购在途运单录入与跟踪页面已移除；数据库层删除业务表并清理 core_menus / core_permissions。

不可逆：downgrade 返回空字符串。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_purchase_logistics" CASCADE;

        DELETE FROM "core_menus"
        WHERE "path" LIKE '/apps/kuaizhizao/purchase-management/logistics-tracking%';

        DELETE FROM "core_permissions"
        WHERE "code" = 'kuaizhizao:logistics-tracking:view';

        DELETE FROM "core_menus"
        WHERE "path" LIKE '/apps/master-data/factory/topology%';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
