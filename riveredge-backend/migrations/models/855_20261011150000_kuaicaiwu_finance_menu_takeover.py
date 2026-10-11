"""
轻财务启用时抑制快制造「财务管理」侧栏（菜单接管）

Author: RiverEdge Team
Date: 2026-10-11
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_menus AS m
        SET is_active = FALSE,
            meta = COALESCE(m.meta, '{}'::jsonb) || '{"suppressed_by_takeover": "kuaicaiwu"}'::jsonb,
            updated_at = NOW()
        FROM core_applications AS caiwu_app,
             core_applications AS zz_app
        WHERE caiwu_app.tenant_id = m.tenant_id
          AND zz_app.tenant_id = m.tenant_id
          AND caiwu_app.code = 'kuaicaiwu'
          AND zz_app.code = 'kuaizhizao'
          AND caiwu_app.is_active = TRUE
          AND caiwu_app.is_installed = TRUE
          AND caiwu_app.deleted_at IS NULL
          AND zz_app.deleted_at IS NULL
          AND m.application_uuid = zz_app.uuid::text
          AND m.path LIKE '/apps/kuaizhizao/finance-management%'
          AND m.deleted_at IS NULL
          AND m.is_active = TRUE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_menus AS m
        SET is_active = TRUE,
            meta = m.meta - 'suppressed_by_takeover',
            updated_at = NOW()
        WHERE m.meta ->> 'suppressed_by_takeover' = 'kuaicaiwu'
          AND m.deleted_at IS NULL;
    """
