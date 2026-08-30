"""快格轻制造 — 销售订单同步绑定表 apps_kuaizhizao_sales_order_sync_binding。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_order_sync_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'order_code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_kuaizhizao_so_sync_bind_tenant"
            ON "apps_kuaizhizao_sales_order_sync_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_order_sync_binding" CASCADE;
    """
