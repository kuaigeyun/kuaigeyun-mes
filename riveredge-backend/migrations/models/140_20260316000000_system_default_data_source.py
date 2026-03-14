"""
系统默认数据源

为每个租户创建 code=system_default 的 PostgreSQL 数据源。
密码来自环境变量，不落库。config 仅存 {"_system_default": true} 标识。

Author: 系统默认数据源
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 为每个租户创建系统默认数据源（若不存在）
        INSERT INTO "core_integration_configs" (
            "uuid", "tenant_id", "name", "code", "type", "description",
            "config", "is_active", "is_connected", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            t.id,
            '系统默认数据库',
            'system_default',
            'postgresql',
            '应用主数据库，密码来自环境变量，不可编辑',
            '{"_system_default": true}'::jsonb,
            true,
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM "infra_tenants" t
        WHERE NOT EXISTS (
            SELECT 1 FROM "core_integration_configs" c
            WHERE c.tenant_id = t.id AND c.code = 'system_default' AND c.deleted_at IS NULL
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 软删除系统默认数据源
        UPDATE "core_integration_configs"
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE code = 'system_default' AND deleted_at IS NULL;
    """
