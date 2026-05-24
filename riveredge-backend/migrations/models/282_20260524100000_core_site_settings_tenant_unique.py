"""
core_site_settings：清理重复记录并为 tenant_id 添加唯一约束（未软删）。

组织初始化并发时可能插入多条站点设置，导致 get_or_none 抛出 MultipleObjectsReturned。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        WITH keepers AS (
            SELECT MIN(id) AS id
            FROM core_site_settings
            WHERE deleted_at IS NULL AND tenant_id IS NOT NULL
            GROUP BY tenant_id
        )
        UPDATE core_site_settings AS s
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE s.deleted_at IS NULL
          AND s.tenant_id IS NOT NULL
          AND s.id NOT IN (SELECT id FROM keepers);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_core_site_settings_tenant_active
            ON core_site_settings (tenant_id)
            WHERE deleted_at IS NULL AND tenant_id IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS uq_core_site_settings_tenant_active;
    """
