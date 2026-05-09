"""
专用应用（market_category=dedicated / is_dedicated）：
- core_applications.is_dedicated：扫描 manifest 时写入
- core_application_dedicated_bindings：平台管理员将专用应用绑定到组织后，该组织才能在应用中心看到该应用
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE core_applications ADD COLUMN IF NOT EXISTS is_dedicated BOOLEAN NOT NULL DEFAULT FALSE;

        CREATE TABLE IF NOT EXISTS core_application_dedicated_bindings (
            id SERIAL PRIMARY KEY,
            app_code VARCHAR(50) NOT NULL,
            tenant_id INT NOT NULL REFERENCES infra_tenants(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_app_dedicated_binding UNIQUE (app_code, tenant_id)
        );
        CREATE INDEX IF NOT EXISTS idx_app_dedicated_bindings_tenant ON core_application_dedicated_bindings(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_app_dedicated_bindings_code ON core_application_dedicated_bindings(app_code);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS core_application_dedicated_bindings;
        ALTER TABLE core_applications DROP COLUMN IF EXISTS is_dedicated;
    """
