"""
回填根入口菜单 permission_code：
- 系统根入口 /system -> system:entry:read
- 应用根入口 /apps/{app_code} -> {app_code}:entry:read
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "core_menus"
        SET "permission_code" = 'system:entry:read',
            "updated_at" = NOW()
        WHERE "deleted_at" IS NULL
          AND "path" = '/system'
          AND ("permission_code" IS NULL OR BTRIM("permission_code") = '');

        UPDATE "core_menus"
        SET "permission_code" = LOWER(REGEXP_REPLACE("path", '^/apps/([^/]+)$', '\\1:entry:read')),
            "updated_at" = NOW()
        WHERE "deleted_at" IS NULL
          AND "path" ~ '^/apps/[^/]+$'
          AND ("permission_code" IS NULL OR BTRIM("permission_code") = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """降级不回退历史 permission_code，保持 no-op。"""
    return "-- backfill root menu permission_code: no-op downgrade"
