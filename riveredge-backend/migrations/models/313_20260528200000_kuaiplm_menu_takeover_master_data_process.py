"""
快研发启用时抑制主数据「工艺数据」菜单（菜单接管）

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_menus AS m
        SET is_active = FALSE,
            meta = COALESCE(m.meta, '{}'::jsonb) || '{"suppressed_by_takeover": "kuaiplm"}'::jsonb,
            updated_at = NOW()
        FROM core_applications AS kuaiplm_app,
             core_applications AS md_app
        WHERE kuaiplm_app.tenant_id = m.tenant_id
          AND md_app.tenant_id = m.tenant_id
          AND kuaiplm_app.code = 'kuaiplm'
          AND md_app.code = 'master-data'
          AND kuaiplm_app.is_active = TRUE
          AND kuaiplm_app.is_installed = TRUE
          AND kuaiplm_app.deleted_at IS NULL
          AND md_app.deleted_at IS NULL
          AND m.application_uuid = md_app.uuid::text
          AND m.path LIKE '/apps/master-data/process%'
          AND m.deleted_at IS NULL
          AND m.is_active = TRUE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_menus AS m
        SET is_active = TRUE,
            meta = m.meta - 'suppressed_by_takeover',
            updated_at = NOW()
        WHERE m.meta ->> 'suppressed_by_takeover' = 'kuaiplm'
          AND m.deleted_at IS NULL;
    """
