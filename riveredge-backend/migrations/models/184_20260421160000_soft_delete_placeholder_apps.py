"""
软删除三个已下线的占位应用（kuaicrm / kuaipdm / kuaichain），
并停用、隐藏其残留菜单。

与 application_service 中的 _PLACEHOLDER_APP_CODES 过滤器双保险：
前端仍有历史数据库行时也不会再出现在列表中。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_applications"
        SET "is_installed" = FALSE,
            "is_active" = FALSE,
            "deleted_at" = CURRENT_TIMESTAMP
        WHERE "code" IN ('kuaicrm', 'kuaipdm', 'kuaichain')
          AND ("deleted_at" IS NULL);

        UPDATE "core_menus"
        SET "is_active" = FALSE,
            "deleted_at" = CURRENT_TIMESTAMP
        WHERE (
                "path" LIKE '/apps/kuaicrm%'
             OR "path" LIKE '/apps/kuaipdm%'
             OR "path" LIKE '/apps/kuaichain%'
            )
          AND ("deleted_at" IS NULL);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 不可逆：历史占位应用数据保留在数据库中，人工需要可单独恢复。
    return ""
