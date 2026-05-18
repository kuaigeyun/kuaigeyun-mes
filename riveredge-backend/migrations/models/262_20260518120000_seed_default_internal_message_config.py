"""为各租户补齐站内信默认消息配置（点检上报等依赖）。"""

from tortoise import BaseDBAsyncClient

CONFIG_CODE = "default_internal"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        INSERT INTO core_message_configs
            (uuid, tenant_id, name, code, type, description, config, is_active, is_default, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            t.id,
            '站内信（系统默认）',
            '{CONFIG_CODE}',
            'internal',
            '系统自动创建，用于站内信投递',
            '{{}}'::jsonb,
            TRUE,
            TRUE,
            NOW(),
            NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_message_configs c
            WHERE c.tenant_id = t.id
              AND c.type = 'internal'
              AND c.is_default = TRUE
              AND c.deleted_at IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        UPDATE core_message_configs
        SET deleted_at = NOW()
        WHERE code = '{CONFIG_CODE}' AND type = 'internal' AND deleted_at IS NULL;
    """
