from aerich.ddl import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "root_menus" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "path" VARCHAR(200),
            "icon" VARCHAR(100),
            "component" VARCHAR(500),
            "permission_code" VARCHAR(100),
            "application_uuid" VARCHAR(36),
            "parent_id" INT,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_external" BOOLEAN NOT NULL DEFAULT FALSE,
            "external_url" VARCHAR(500),
            "meta" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_root_menus_parent" FOREIGN KEY ("parent_id") REFERENCES "root_menus" ("id") ON DELETE SET NULL
        );
COMMENT ON TABLE "root_menus" IS '菜单表';
        CREATE INDEX IF NOT EXISTS "idx_root_menus_tenant_id" ON "root_menus" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_parent_id" ON "root_menus" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_application_uuid" ON "root_menus" ("application_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_permission_code" ON "root_menus" ("permission_code");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_sort_order" ON "root_menus" ("sort_order");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_is_active" ON "root_menus" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_menus_created_at" ON "root_menus" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "root_menus";
    """

