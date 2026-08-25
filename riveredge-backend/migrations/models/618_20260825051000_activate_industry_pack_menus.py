"""
行业包容器已启用但侧栏菜单仍为 is_active=false 的历史数据修复。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_menus m
        SET is_active = TRUE, updated_at = NOW()
        FROM core_applications a
        WHERE m.tenant_id = a.tenant_id
          AND m.application_uuid = a.uuid
          AND a.code = 'industry-pack'
          AND a.is_installed = TRUE
          AND a.is_active = TRUE
          AND m.deleted_at IS NULL
          AND a.deleted_at IS NULL
          AND m.is_active = FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
