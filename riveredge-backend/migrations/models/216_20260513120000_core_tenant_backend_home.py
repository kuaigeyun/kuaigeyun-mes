"""
租户后台首页配置表 core_tenant_backend_home

每租户一行：指向 core_menus.uuid；设置新首页时替换该行（排他）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_tenant_backend_home" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tenant_id" INT NOT NULL UNIQUE REFERENCES "infra_tenants"("id") ON DELETE CASCADE,
            "menu_uuid" VARCHAR(36) NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_core_tenant_backend_home_tenant"
            ON "core_tenant_backend_home" ("tenant_id");
        COMMENT ON TABLE "core_tenant_backend_home" IS '租户后台首页：单菜单指针，与 core_menus 分离存储';
        COMMENT ON COLUMN "core_tenant_backend_home"."tenant_id" IS '组织 ID（唯一）';
        COMMENT ON COLUMN "core_tenant_backend_home"."menu_uuid" IS '菜单 UUID（core_menus.uuid）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_tenant_backend_home";
    """
